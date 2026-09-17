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

$raw = file_get_contents('php://input');
$body = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
if (!is_array($body)) $body = [];

$to = strtolower(trim((string) ($body['to'] ?? '')));
$shopName = trim((string) ($body['shopName'] ?? ''));
$serviceName = trim((string) ($body['serviceName'] ?? ''));
$date = trim((string) ($body['date'] ?? ''));
$time = trim((string) ($body['time'] ?? ''));
$bikeNumber = trim((string) ($body['bikeNumber'] ?? ''));
$bikeType = trim((string) ($body['bikeType'] ?? ''));
$contactName = trim((string) ($body['contactName'] ?? ''));
$phone = trim((string) ($body['phone'] ?? ''));
$notes = trim((string) ($body['notes'] ?? ''));
$totalLkr = (int) ($body['totalLkr'] ?? 0);

if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
  respond(400, ['ok' => false, 'message' => 'Enter a valid email address.']);
}
if ($shopName === '' || $serviceName === '' || $date === '' || $time === '') {
  respond(400, ['ok' => false, 'message' => 'Missing booking details.']);
}

$host = (string) (getenv('SMTP_HOST') ?: '');
$port = (int) (getenv('SMTP_PORT') ?: 587);
$username = (string) (getenv('SMTP_USERNAME') ?: '');
$password = (string) (getenv('SMTP_PASSWORD') ?: '');
$secure = strtolower((string) (getenv('SMTP_SECURE') ?: 'tls'));
$fromEmail = (string) (getenv('OTP_MAIL_FROM_EMAIL') ?: $username);
$fromName = (string) (getenv('OTP_MAIL_FROM_NAME') ?: 'BikeBuddy');

if ($host === '' || $username === '' || $password === '' || $fromEmail === '') {
  respond(500, ['ok' => false, 'message' => 'SMTP is not configured.']);
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
  $mail->addAddress($to);
  $mail->isHTML(true);
  $mail->Subject = 'BikeBuddy booking confirmation';
  $mail->Body =
    '<p>Your booking is confirmed.</p>' .
    '<p><strong>Shop:</strong> ' . htmlspecialchars($shopName, ENT_QUOTES, 'UTF-8') . '<br/>' .
    '<strong>Service:</strong> ' . htmlspecialchars($serviceName, ENT_QUOTES, 'UTF-8') . '<br/>' .
    '<strong>Date/Time:</strong> ' . htmlspecialchars($date . ' ' . $time, ENT_QUOTES, 'UTF-8') . '<br/>' .
    '<strong>Bike:</strong> ' . htmlspecialchars($bikeNumber . ' (' . $bikeType . ')', ENT_QUOTES, 'UTF-8') . '<br/>' .
    '<strong>Contact:</strong> ' . htmlspecialchars($contactName, ENT_QUOTES, 'UTF-8') . '<br/>' .
    '<strong>Phone:</strong> ' . htmlspecialchars($phone, ENT_QUOTES, 'UTF-8') . '<br/>' .
    '<strong>Total:</strong> LKR ' . number_format(max(0, $totalLkr)) . '</p>' .
    ($notes !== '' ? '<p><strong>Notes:</strong> ' . nl2br(htmlspecialchars($notes, ENT_QUOTES, 'UTF-8')) . '</p>' : '');
  $mail->AltBody =
    "Your booking is confirmed.\n" .
    "Shop: {$shopName}\n" .
    "Service: {$serviceName}\n" .
    "Date/Time: {$date} {$time}\n" .
    "Bike: {$bikeNumber} ({$bikeType})\n" .
    "Contact: {$contactName}\n" .
    "Phone: {$phone}\n" .
    'Total: LKR ' . number_format(max(0, $totalLkr)) .
    ($notes !== '' ? "\nNotes: {$notes}" : '');

  $mail->send();
  respond(200, ['ok' => true]);
} catch (MailerException $e) {
  respond(500, ['ok' => false, 'message' => 'Email could not be sent: ' . $e->getMessage()]);
}
