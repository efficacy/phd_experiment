#!/bin/bash
# default script to notify the CTRL service that this device is ready
# should be provided with an argument with the URL to call back
curl $1
