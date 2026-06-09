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

$word = $null
$document = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $document = $word.Documents.Open(
    $InputPath,
    $false,
    $true,
    $false
  )

  if ($OutputType -eq "docx") {
    # 16 = wdFormatXMLDocument
    $document.SaveAs2($OutputPath, 16)
  } else {
    # 17 = wdFormatPDF
    $document.SaveAs2($OutputPath, 17)
  }
} finally {
  if ($document -ne $null) {
    $document.Close($false)
  }

  if ($word -ne $null) {
    $word.Quit()
  }
}
