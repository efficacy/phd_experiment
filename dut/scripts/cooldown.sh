#!/bin/bash
# Coold down any specific software then notify the CTRL service when it is donw
echo 'cool down'

# Should be provided with an argument with the URL to call back
curl -s $1
