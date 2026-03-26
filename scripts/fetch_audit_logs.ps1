try {
    $r = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/dev/create-admin-and-test-users' -ErrorAction Stop
    $token = $r.token
    Write-Output "DEV_TOKEN:$token"

    $logs = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/admin/audit-logs' -Headers @{ Authorization = "Bearer $token" } -ErrorAction Stop
    $logs | ConvertTo-Json -Depth 10
} catch {
    if ($_.Exception.Response) {
        try {
            $resp = $_.Exception.Response
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $body = $reader.ReadToEnd()
            Write-Output "RESPONSE_BODY:$body"
        } catch {
            # ignore
        }
    }
    Write-Error "ERROR: $($_.Exception.Message)"
    exit 1
}
