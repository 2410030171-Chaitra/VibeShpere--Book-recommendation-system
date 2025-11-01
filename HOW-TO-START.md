# 🚀 VibeSphere Website - Quick Start Guide

## 🌟 **How to Start Your Website**

### **Option 1: Double-click the script (Easy)**
1. Double-click `start-website.sh` 
2. Website will open automatically at `http://localhost:5173/`

### **Option 2: Terminal command**
```bash
./start-website.sh
```

## 🛑 **How to Stop Your Website**

### **Option 1: Double-click**
1. Double-click `stop-website.sh`

### **Option 2: Terminal command**
```bash
./stop-website.sh
```

## 🔗 **Website URLs**
- **Local**: `http://localhost:5173/`
- **Network** (for others): `http://192.168.0.103:5173/`
- **Database Admin**: Open `database-admin.html` in browser
- **Database CLI**: Run `./db-viewer.sh`

## 📊 **Your Database**
- **Users**: 3 sample users
- **Books**: 5 books (fiction & non-fiction)
- **Reviews**: Sample reviews and ratings
- **MongoDB**: Running locally

## 🔧 **Troubleshooting**

### **If website doesn't open:**
1. Run `./start-website.sh` 
2. Wait 5 seconds
3. Go to `http://localhost:5173/`

### **If you get errors:**
1. Run `./stop-website.sh`
2. Wait 2 seconds  
3. Run `./start-website.sh`

### **Check if servers are running:**
```bash
ps aux | grep -E "(node.*server|vite)" | grep -v grep
```

## 🎯 **Daily Usage**
1. **Open VS Code** → Open your project folder
2. **Start Website** → Run `./start-website.sh` or double-click it
3. **Use Website** → Go to `http://localhost:5173/`
4. **Close** → Run `./stop-website.sh` when done

**That's it! Your website will work every time! 🎉**