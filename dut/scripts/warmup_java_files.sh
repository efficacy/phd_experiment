#!/bin/bash
# Warm up any specific software then notify the CTRL service that this device is ready
echo 'warm up Java static server'
java -jar /home/pi/exp/dut/server.jar /var/www/html &
sleep 1

# Should be provided with an argument with the URL to call back
curl -s $1
