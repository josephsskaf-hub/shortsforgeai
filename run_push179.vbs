' run_push179.vbs — silently kills stale git, removes locks, runs push179.bat

Option Explicit
Dim oShell, sRepo
oShell = CreateObject("WScript.Shell")
sRepo  = "C:\Users\win\Downloads\shortsforgeai"

' Kill any stale git.exe silently
oShell.Run "taskkill /F /IM git.exe /T", 0, True

' Remove lock files silently
oShell.Run "cmd /c del /f /q """ & sRepo & "\.git\index.lock"" 2>nul", 0, True
oShell.Run "cmd /c del /f /q """ & sRepo & "\.git\HEAD.lock"" 2>nul", 0, True

' Run the bat with a visible window so progress is readable
oShell.Run """C:\Users\win\Downloads\push179.bat""", 1, False
