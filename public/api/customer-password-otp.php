<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$allowCors = getenv('CUSTOMER_OTP_CORS') ?: '1';
if ($allowCors === '1' || $allowCors === 'true' || $allowCors === '*') {
  $origin = (string) (getenv('CORS_ALLOW_ORIGIN') ?: '*');
  header('Access-Control-Allow-Origin: ' . $origin, true);
  header('Access-Control-Allow-Methods: POST, OPTIONS', true);
  header('Access-Control-Allow-Headers: Content-Type', true);
  header('Vary: Origin', true);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
  exit;
}

$autoload = dirname(__DIR__, 2) . '/vendor/autoload.php';
if (!is_file($autoload)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'message' => 'PHPMailer is not installed. Run composer install.']);
  exit;
}
require_once $autoload;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailerException;

function respond(int $status, array $payload): void {
  http_response_code($status);
  echo json_encode($payload);
  exit;
}

function read_json_input(): array {
  $raw = file_get_contents('php://input');
  if (!is_string($raw) || $raw === '') return [];
  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : [];
}

function is_valid_email(string $email): bool {
  return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

function hmac_sign(string $data, string $secret): string {
  return hash_hmac('sha256', $data, $secret, true);
}

function b64url_encode(string $data): string {
  return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function create_reset_token(string $email, int $expiresAt, string $secret): string {
  $payload = b64url_encode(json_encode(['email' => $email, 'exp' => $expiresAt], JSON_UNESCAPED_SLASHES));
  $sig = b64url_encode(hmac_sign($payload, $secret));
  return $payload . '.' . $sig;
}

function storage_path(): string {
  $base = dirname(__DIR__, 2) . '/runtime';
  if (!is_dir($base) && !@mkdir($base, 0755, true) && !is_dir($base)) {
    respond(500, ['ok' => false, 'message' => 'Server storage is not writable.']);
  }
  return $base . '/customer-password-otp.json';
}

function load_store(): array {
  $path = storage_path();
  if (!is_file($path)) return [];
  $raw = file_get_contents($path);
  if (!is_string($raw) || $raw === '') return [];
  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : [];
}

function save_store(array $store): void {
  $path = storage_path();
  file_put_contents($path, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function normalize_email(string $email): string {
  return strtolower(trim($email));
}

function send_otp_mail(string $toEmail, string $otpCode): void {
  $host = (string) (getenv('SMTP_HOST') ?: '');
  $port = (int) (getenv('SMTP_PORT') ?: 587);
  $username = (string) (getenv('SMTP_USERNAME') ?: '');
  $password = (string) (getenv('SMTP_PASSWORD') ?: '');
  $secure = strtolower((string) (getenv('SMTP_SECURE') ?: 'tls'));
  $fromEmail = (string) (getenv('OTP_MAIL_FROM_EMAIL') ?: $username);
  $fromName = (string) (getenv('OTP_MAIL_FROM_NAME') ?: 'BikeBuddy');

  if ($host === '' || $username === '' || $password === '' || $fromEmail === '') {
    throw new RuntimeException('SMTP is not configured.');
  }

  $mail = new PHPMailer(true);
  try {
    $mail->isSMTP();
    $mail->Host = $host;
    $mail->SMTPAuth = true;
    $mail->Username = $username;
    $mail->Password = $password;
    $mail->Port = $port;
    $mail->SMTPSecure = $secure === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;

    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($toEmail);
    $mail->isHTML(true);
    $mail->Subject = 'BikeBuddy password reset OTP';
    $mail->Body = '<p>Your BikeBuddy password reset code is:</p><h2 style="letter-spacing:3px;">' .
      htmlspecialchars($otpCode, ENT_QUOTES, 'UTF-8') .
      '</h2><p>This code expires in 10 minutes.</p>';
    $mail->AltBody = "Your BikeBuddy password reset code is: {$otpCode}\nThis code expires in 10 minutes.";
    $mail->send();
  } catch (MailerException $e) {
    throw new RuntimeException('Email could not be sent: ' . $e->getMessage());
  }
}

$body = read_json_input();
$action = (string) ($body['action'] ?? '');
$email = normalize_email((string) ($body['email'] ?? ''));

if (!in_array($action, ['request_otp', 'resend_otp', 'verify_otp'], true)) {
  respond(400, ['ok' => false, 'message' => 'Invalid action.']);
}
if (!is_valid_email($email)) {
  respond(400, ['ok' => false, 'message' => 'Enter a valid email address.']);
}

$otpTtlSeconds = 10 * 60;
$now = time();
$store = load_store();

if ($action === 'request_otp' || $action === 'resend_otp') {
  $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
  $salt = bin2hex(random_bytes(8));
  $otpHash = hash('sha256', $salt . '|' . $otp);
  $store[$email] = [
    'salt' => $salt,
    'otpHash' => $otpHash,
    'expiresAt' => $now + $otpTtlSeconds,
    'attempts' => 0,
    'verified' => false,
  ];
  save_store($store);
  try {
    send_otp_mail($email, $otp);
  } catch (Throwable $e) {
    respond(500, ['ok' => false, 'message' => $e->getMessage()]);
  }
  respond(200, ['ok' => true, 'message' => 'If that email is registered, you will receive a verification code shortly.']);
}

$otp = trim((string) ($body['otp'] ?? ''));
if (!preg_match('/^\d{6}$/', $otp)) {
  respond(400, ['ok' => false, 'message' => 'Enter a valid 6-digit code.']);
}

$row = $store[$email] ?? null;
if (!is_array($row)) {
  respond(400, ['ok' => false, 'message' => 'Invalid or expired verification code.']);
}
if ((int) ($row['expiresAt'] ?? 0) < $now) {
  unset($store[$email]);
  save_store($store);
  respond(400, ['ok' => false, 'message' => 'Verification code expired.']);
}

$attempts = (int) ($row['attempts'] ?? 0);
if ($attempts >= 5) {
  unset($store[$email]);
  save_store($store);
  respond(400, ['ok' => false, 'message' => 'Too many attempts. Request a new code.']);
}

$salt = (string) ($row['salt'] ?? '');
$expectedHash = (string) ($row['otpHash'] ?? '');
$actualHash = hash('sha256', $salt . '|' . $otp);
if ($salt === '' || $expectedHash === '' || !hash_equals($expectedHash, $actualHash)) {
  $row['attempts'] = $attempts + 1;
  $store[$email] = $row;
  save_store($store);
  respond(400, ['ok' => false, 'message' => 'Invalid or expired verification code.']);
}

$tokenSecret = (string) (getenv('OTP_RESET_TOKEN_SECRET') ?: '');
if ($tokenSecret === '') {
  respond(500, ['ok' => false, 'message' => 'OTP reset token secret is not configured.']);
}

unset($store[$email]);
save_store($store);

$resetToken = create_reset_token($email, $now + (15 * 60), $tokenSecret);
respond(200, ['ok' => true, 'resetToken' => $resetToken]);
