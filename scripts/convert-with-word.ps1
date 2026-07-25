param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [Parameter(Mandatory = $true)]
  [ValidateSet("docx", "pdf")]
  [string]$OutputType
)

$ErrorActionPreference = "Stop"

# Allow only application folders
$base = Split-Path -Parent $PSScriptRoot

$allowedInput = Join-Path $base "uploads"
$allowedOutput = Join-Path $base "converted"

$resolvedInput = (Resolve-Path $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)

if (-not $resolvedInput.StartsWith($allowedInput)) {
    throw "Invalid input path"
}

if (-not $resolvedOutput.StartsWith($allowedOutput)) {
    throw "Invalid output path"
}

$word = $null
$document = $null

try {

  $word = New-Object -ComObject Word.Application

  $word.Visible = $false
  $word.DisplayAlerts = 0

  # Disable macros
  $word.AutomationSecurity = 3

  $document = $word.Documents.Open(
    $resolvedInput,
    $false,
    $true,
    $false
  )

  if ($OutputType -eq "docx") {

    $document.SaveAs2(
      $resolvedOutput,
      16
    )

  } else {

    $document.SaveAs2(
      $resolvedOutput,
      17
    )
  }

}
finally {

  if ($document -ne $null) {
    $document.Close($false)
  }

  if ($word -ne $null) {
    $word.Quit()
  }

}
