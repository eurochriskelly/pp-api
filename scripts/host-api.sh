#!/bin/bash

cd docs/api

if [ ! -f "openapi.yaml" ];then
  echo "No openapi.yaml found. Exiting!"
  exit 1
fi

npx @redocly/cli bundle openapi.yaml -o openapi_bundle.yaml

if [ ! -f "openapi_bundle.yaml" ];then
  echo "Something went wrong. Could not bundle openai yaml. Check spec!"
  ls
  exit 1  
fi

npx @redocly/cli build-docs openapi_bundle.yaml 

if [ ! -f "redoc-static.html" ];then
  echo "Something went wrong. Could not build static api docs. Check spec!"
  ls
  exit 1  
fi

mv redoc-static.html index.html
httpster -p 4444
