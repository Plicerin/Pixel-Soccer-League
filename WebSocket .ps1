param(
    [string]$Url = "ws://localhost:8081",
    [int]$TimeoutSeconds = 5
)

Add-Type -AssemblyName System.Net.Http

$client = New-Object System.Net.WebSockets.ClientWebSocket
$cts = New-Object System.Threading.CancellationTokenSource
$cts.CancelAfter($TimeoutSeconds * 1000)

Write-Host "Checking WebSocket server at $Url ..."

try {
    $task = $client.ConnectAsync($Url, $cts.Token)
    $task.Wait()

    if ($client.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        Write-Host "WebSocket is RUNNING" -ForegroundColor Green
    } else {
        Write-Host "WebSocket is NOT running (state: $($client.State))" -ForegroundColor Red
    }
}
catch {
    Write-Host "Connection failed — WebSocket is NOT running" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)"
}
finally {
    if ($client.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $client.CloseAsync(
            [System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure,
            "Check complete",
            $cts.Token
        ).Wait()
    }
}

