#!/bin/bash
( cd exp/registry; node registry.js 2>&1 >/home/frank/logs/registry.log & )
echo started registry
( cd exp/logger; REGISTRY=192.168.0.187:9997 node logger.js 2>&1 >/home/frank/logs/logger.log & )
echo started logger
