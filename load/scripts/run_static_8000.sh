#!/bin/bash
# script to run the test and notify the CTRL service when complete
# should be provided with an argument with the URL to call back
echo $1
siege http://192.168.0.183:8000/static/index.html -r 100
curl -s $1
