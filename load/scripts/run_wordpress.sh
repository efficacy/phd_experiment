#!/bin/bash
# script to run the test and notify the CTRL service when complete
# should be provided with an argument with the URL to call back
echo $1
target=${DUT:-192.168.0.179}
siege http://${target}/wordpress/index.php/2022/03/29/hello-world/ -r 100
curl -s $1
