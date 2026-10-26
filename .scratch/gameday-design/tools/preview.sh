#!/bin/sh
# Wrap index.html the way the publish skeleton does, with three.js from the local copy.
G=$(dirname "$0")/../prototype
{ printf '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%%}[hidden]{display:none!important}</style></head><body>'
  sed 's#https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js#vendor/three.min.js#' "$G/index.html"
  printf '</body></html>'; } > "$G/preview.html"
