#!/bin/sh
# Fix ownership of mounted volume, then run as nodeapp
if [ -d /data ]; then
  # Only chown if running as root (initial container start)
  if [ "$(id -u)" = "0" ]; then
    chown -R nodeapp:nodejs /data 2>/dev/null
    exec su-exec nodeapp "$@"
  fi
fi
exec "$@"
