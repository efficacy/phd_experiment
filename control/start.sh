#!/bin/bash
cd exp/control
nohup node control.js >>/home/pi/logs/control.log &
