@echo off
title SEO GEO Test
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode
node -e "process.exit(+process.versions.node.split(String.fromCharCode(46))[0]>=18?0:1)"
if errorlevel 1 goto oldnode
if exist node_modules\playwright-core goto run
echo Premier lancement : installation d'un composant, quelques secondes...
call npm install --omit=dev --no-audit --no-fund > install.log 2>&1
if errorlevel 1 echo Installation impossible, voir install.log. L'audit marche, la mesure par navigateur sera indisponible.
:run
set SEOLAB_OPEN=1
node server.mjs
if %errorlevel%==0 exit /b 0
echo.
echo Le serveur s'est arrete. Code : %errorlevel%
pause
exit /b
:nonode
echo Node.js est necessaire et n'est pas installe.
echo Installe la version LTS depuis https://nodejs.org puis relance ce raccourci.
start https://nodejs.org/fr/download
pause
exit /b 1
:oldnode
echo Ta version de Node.js est trop ancienne : installe la version LTS depuis https://nodejs.org
pause
exit /b 1
