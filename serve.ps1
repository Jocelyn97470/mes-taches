# Mini-serveur local pour tester "Mes Tâches Chantier"
# Lancer : clic droit sur ce fichier > Exécuter avec PowerShell
# Puis ouvrir : http://localhost:8123/
# Arrêter : fermer la fenêtre PowerShell (ou Ctrl+C)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8123/')
$listener.Start()
Write-Host "Serveur demarre : http://localhost:8123/  (fermer cette fenetre pour arreter)"

$mime = @{
  '.html'        = 'text/html; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.js'          = 'application/javascript; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
  '.svg'         = 'image/svg+xml'
  '.json'        = 'application/json; charset=utf-8'
  '.png'         = 'image/png'
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $chemin = $ctx.Request.Url.AbsolutePath
  if ($chemin -eq '/') { $chemin = '/index.html' }
  $fichier = Join-Path $root ($chemin.TrimStart('/') -replace '/', '\')

  if ((Test-Path $fichier -PathType Leaf) -and ((Resolve-Path $fichier).Path.StartsWith($root))) {
    $octets = [System.IO.File]::ReadAllBytes($fichier)
    $ext = [System.IO.Path]::GetExtension($fichier).ToLower()
    if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
    $ctx.Response.OutputStream.Write($octets, 0, $octets.Length)
  }
  else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.Close()
}
