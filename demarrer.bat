@echo off
title Amicale ATTT — Démarrage
color 0A

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║          Amicale ATTT — Serveurs locaux          ║
echo  ╚══════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Vérifier Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo  [ERREUR] Node.js n'est pas installé.
  echo  Téléchargez-le sur https://nodejs.org
  pause
  exit /b 1
)

:: Vérifier Python
where python >nul 2>&1
if errorlevel 1 (
  echo  [ERREUR] Python n'est pas installé.
  pause
  exit /b 1
)

echo  [1/2] Démarrage du serveur de déploiement (port 8081)...
start "ATTT - Serveur Deploiement" cmd /k "cd /d "%~dp0" && node deploy-server.js"

timeout /t 1 /nobreak >nul

echo  [2/2] Démarrage du serveur web (port 8080)...
start "ATTT - Serveur Web" cmd /k "cd /d "%~dp0" && python -m http.server 8080"

timeout /t 2 /nobreak >nul

echo  [3/3] Ouverture du site...
start http://localhost:8080

echo.
echo  ✔  Tout est démarré !
echo.
echo  Site web   : http://localhost:8080
echo  Guide      : http://localhost:8080/guide.html
echo  Deploy API : http://localhost:8081/api/status
echo.
echo  Fermez cette fenêtre pour tout arrêter.
pause
