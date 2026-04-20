# deploy.ps1 — Deploy CaterTrax Dashboard to Google Cloud Run
# Usage: .\deploy.ps1

$Project = "buck-a-shuck"

# Read .env file into a hashtable
$env = @{}
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.+?)\s*$') {
        $env[$Matches[1]] = $Matches[2]
    }
}

$supabaseUrl = $env['VITE_SUPABASE_URL']
$supabaseKey = $env['VITE_SUPABASE_ANON_KEY']
$siteId      = $env['VITE_DEMO_SITE_ID']

if (-not $supabaseUrl -or -not $supabaseKey) {
    Write-Error "VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing from .env"
    exit 1
}

Write-Host "Submitting build to Cloud Build..." -ForegroundColor Cyan

gcloud builds submit . `
    --config cloudbuild.yaml `
    --project $Project `
    --substitutions "_VITE_SUPABASE_URL=$supabaseUrl,_VITE_SUPABASE_ANON_KEY=$supabaseKey,_VITE_DEMO_SITE_ID=$siteId"
