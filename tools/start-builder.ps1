param(
    [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$Address = [System.Net.IPAddress]::Loopback
$Listener = New-Object System.Net.Sockets.TcpListener($Address, $Port)

function Get-ContentType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.htm'  { return 'text/html; charset=utf-8' }
        '.js'   { return 'text/javascript; charset=utf-8' }
        '.mjs'  { return 'text/javascript; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.webmanifest' { return 'application/manifest+json; charset=utf-8' }
        '.png'  { return 'image/png' }
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.gif'  { return 'image/gif' }
        '.webp' { return 'image/webp' }
        '.svg'  { return 'image/svg+xml' }
        '.ico'  { return 'image/x-icon' }
        '.woff' { return 'font/woff' }
        '.woff2' { return 'font/woff2' }
        '.ttf'  { return 'font/ttf' }
        '.mp3'  { return 'audio/mpeg' }
        '.wav'  { return 'audio/wav' }
        default { return 'application/octet-stream' }
    }
}

function Send-Response($Stream, [int]$Status, [string]$StatusText, [byte[]]$Body, [string]$ContentType, [bool]$HeadOnly) {
    if ($null -eq $Body) { $Body = New-Object byte[] 0 }
    $Header = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
    $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
    if (-not $HeadOnly -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
    $Stream.Flush()
}

try {
    $Listener.Start()
} catch {
    Write-Host "Could not start Little Realm World Builder on port $Port." -ForegroundColor Red
    Write-Host "Another program may already be using that port." -ForegroundColor Yellow
    Write-Host "Try: powershell -ExecutionPolicy Bypass -File tools\start-builder.ps1 -Port 8001"
    exit 1
}

$Url = "http://127.0.0.1:$Port/builder/"
Write-Host ""
Write-Host "Little Realm World Builder" -ForegroundColor Cyan
Write-Host "--------------------------"
Write-Host "Open: $Url"
Write-Host "Keep this window open while editing. Press Ctrl+C to stop."
Write-Host ""

Start-Process $Url

try {
    while ($true) {
        $Client = $Listener.AcceptTcpClient()
        try {
            $Stream = $Client.GetStream()
            $Reader = New-Object System.IO.StreamReader($Stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
            $RequestLine = $Reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($RequestLine)) { continue }

            do { $Line = $Reader.ReadLine() } while ($null -ne $Line -and $Line -ne '')

            $Parts = $RequestLine.Split(' ')
            if ($Parts.Length -lt 2) { continue }
            $Method = $Parts[0].ToUpperInvariant()
            $HeadOnly = ($Method -eq 'HEAD')
            if ($Method -ne 'GET' -and -not $HeadOnly) {
                $Body = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
                Send-Response $Stream 405 'Method Not Allowed' $Body 'text/plain; charset=utf-8' $false
                continue
            }

            $RawPath = $Parts[1].Split('?')[0]
            $DecodedPath = [System.Uri]::UnescapeDataString($RawPath)
            if ($DecodedPath -eq '/') { $DecodedPath = '/index.html' }
            $Relative = $DecodedPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $Candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $Relative))
            $RootPrefix = $Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

            if (-not $Candidate.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and $Candidate -ne $Root) {
                $Body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
                Send-Response $Stream 403 'Forbidden' $Body 'text/plain; charset=utf-8' $HeadOnly
                continue
            }

            if (Test-Path -LiteralPath $Candidate -PathType Container) {
                $Candidate = Join-Path $Candidate 'index.html'
            }

            if (-not (Test-Path -LiteralPath $Candidate -PathType Leaf)) {
                $Body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
                Send-Response $Stream 404 'Not Found' $Body 'text/plain; charset=utf-8' $HeadOnly
                continue
            }

            $Bytes = [System.IO.File]::ReadAllBytes($Candidate)
            Send-Response $Stream 200 'OK' $Bytes (Get-ContentType $Candidate) $HeadOnly
        } catch {
            try {
                $Body = [System.Text.Encoding]::UTF8.GetBytes('Server Error')
                Send-Response $Stream 500 'Internal Server Error' $Body 'text/plain; charset=utf-8' $false
            } catch {}
        } finally {
            if ($null -ne $Reader) { $Reader.Dispose() }
            if ($null -ne $Client) { $Client.Close() }
        }
    }
} finally {
    $Listener.Stop()
}
