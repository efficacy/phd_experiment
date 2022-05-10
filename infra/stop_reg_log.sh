#!/bin/bash
kill `pgrep -f logger`
echo killed logger
kill `pgrep -f registry`
echo killed registry
