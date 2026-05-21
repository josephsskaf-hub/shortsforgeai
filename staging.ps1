Set-Location 'C:\Users\win\Downloads\shortsforgeai'
'Pushing staging to GitHub...' | Out-File debug2.txt
git push origin staging --force 2>&1 | Add-Content debug2.txt
'DONE' | Add-Content debug2.txt
