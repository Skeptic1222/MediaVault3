@echo off
echo Generating video thumbnails for MediaVault...

cd /d C:\inetpub\wwwroot\MediaVault
node server\generate-video-thumbnails.js

echo.
echo Thumbnail generation complete!
pause