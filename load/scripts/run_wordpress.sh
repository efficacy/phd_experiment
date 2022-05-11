#!/bin/bash
# script to run the test and notify the CTRL service when complete
# should be provided with an argument with the URL to call back
echo $1
# just a dummy test for now
siege http://192.168.0.183/wordpress/index.php/2022/03/29/hello-world/ -r 100
curl -s $1
