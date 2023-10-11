#!/bin/bash
# script to run the test and notify the CTRL service when complete
# should be provided with an argument with the URL to call back
echo $1
target=${DUT:-192.168.0.179}
siege http://${target}:8000/index.html -r 1000
curl -s $1
