@echo off
if exist .git\index.lock del /f .git\index.lock
echo Lock removed
