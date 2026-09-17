<?php
/**
 * Part image upload (PHP): saves under public/uploads/parts/{ownerId}/
 * Response JSON: { "url": "https://yoursite.com/uploads/parts/.../file.jpg" }
 * In Firestore store only that url string in imageUrl — not the file bytes.
 *
 * Web root should be the `public` directory (XAMPP / cPanel / Apache + PHP).
 *
 * App env: VITE_PART_IMAGE_UPLOAD_PATH=/api/upload-part-image.php
 *          VITE_ENABLE_PART_FILE_UPLOAD=true
 * Optional: set server env PART_IMAGE_UPLOAD_SECRET and the same value in
 * VITE_PART_IMAGE_UPLOAD_TOKEN (sent as header X-Upload-Token).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$allowCors = getenv('PART_IMAGE_CORS') ?: '1';
if ($allowCors === '1' || $allowCors === 'true' || $allowCors === '*') {
  $o = (string) (getenv('CORS_ALLOW_ORIGIN') ?: '*');
  header('Access-Control-Allow-Origin: ' . $o, true);
  header('Access-Control-Allow-Methods: POST, OPTIONS', true);
  header('Access-Control-Allow-Headers: Content-Type, X-Upload-Token', true);
  header('Vary: Origin', true);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

$secret = (string) (getenv('PART_IMAGE_UPLOAD_SECRET') ?: '');
$token = (string) ($_SERVER['HTTP_X_UPLOAD_TOKEN'] ?? $_POST['token'] ?? '');

if ($secret !== '' && $token === '') {
  http_response_code(403);
  echo json_encode(['error' => 'Missing X-Upload-Token']);
  exit;
}
if ($secret !== '' && !hash_equals($secret, $token)) {
  http_response_code(403);
  echo json_encode(['error' => 'Invalid upload token']);
  exit;
}

if (empty($_FILES['file']['tmp_name'] ?? null) || !is_uploaded_file((string) $_FILES['file']['tmp_name'])) {
  http_response_code(400);
  echo json_encode(['error' => 'No file; use form field name "file".']);
  exit;
}

$f = $_FILES['file'];
if (($f['error'] ?? 0) !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['error' => 'Upload error: ' . (int) $f['error']]);
  exit;
}

$max = 5 * 1024 * 1024;
if (($f['size'] ?? 0) > $max) {
  http_response_code(400);
  echo json_encode(['error' => 'File must be 5MB or smaller']);
  exit;
}

$tmp = (string) $f['tmp_name'];
$fi = new finfo(FILEINFO_MIME_TYPE);
$mime = $fi->file($tmp) ?: '';
$map = [
  'image/jpeg' => 'jpg',
  'image/png' => 'png',
  'image/gif' => 'gif',
  'image/webp' => 'webp',
];
if (!isset($map[$mime])) {
  http_response_code(400);
  echo json_encode(['error' => 'Allowed types: JPEG, PNG, GIF, WebP']);
  exit;
}
$ext = $map[$mime];

$rawOwner = (string) ($_POST['ownerId'] ?? 'public');
$owner = preg_replace('/[^a-zA-Z0-9_-]+/', '_', $rawOwner) ?: 'public';
$owner = substr($owner, 0, 64);

$base = dirname(__DIR__) . '/uploads/parts/' . $owner;
if (!is_dir($base) && !@mkdir($base, 0755, true) && !is_dir($base)) {
  http_response_code(500);
  echo json_encode(['error' => 'Could not create uploads folder']);
  exit;
}

$fname = 'part-' . time() . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
$dest = $base . '/' . $fname;
if (!move_uploaded_file($tmp, $dest)) {
  http_response_code(500);
  echo json_encode(['error' => 'Could not store file on server']);
  exit;
}

$proto = 'http';
if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
  $proto = strtolower((string) preg_replace('/\s+.*$/', '', (string) $_SERVER['HTTP_X_FORWARDED_PROTO']));
} elseif (!empty($_SERVER['HTTPS']) && (string) $_SERVER['HTTPS'] !== 'off') {
  $proto = 'https';
}
$host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
$publicPath = '/uploads/parts/' . $owner . '/' . $fname;
$url = $proto . '://' . $host . $publicPath;
echo json_encode(['url' => $url, 'path' => $publicPath], JSON_UNESCAPED_SLASHES);
