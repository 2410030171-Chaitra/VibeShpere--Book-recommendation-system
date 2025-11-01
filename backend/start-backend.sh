#!/bin/bash
# Start backend server on port 3001

cd "$(dirname "$0")"
PORT=3001 node server.js
