#!/bin/bash
# script to run the test and notify the CTRL service when complete
# should be provided with an argument with the URL to call back
# just a dummy test for now
sleep 10
# ping the controller to let it know we have finished
echo pinging $1
curl -s $1
