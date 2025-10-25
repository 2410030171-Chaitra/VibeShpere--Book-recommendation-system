#!/bin/bash

echo "🛑 Stopping VibeSphere Website..."

# Kill servers
pkill -f "node.*server.js" 2>/dev/null && echo "✅ Backend stopped"
pkill -f "vite" 2>/dev/null && echo "✅ Frontend stopped"

echo "🛑 VibeSphere Website Stopped!"