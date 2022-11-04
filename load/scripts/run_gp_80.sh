#!/bin/bash
# script to run the test and notify the CTRL service when complete
# should be provided with an argument with the URL to call back
echo $1
siege --with-ssl=/usr/bin/openssl http://192.168.0.183/2020/11/23/what-is-sustainability/index.html -r 1000
curl -s $1
