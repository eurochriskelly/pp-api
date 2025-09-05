#!/bin/bash

port=${1:-4000}
PP_DBN=MockTourno ./scripts/start-server.sh $port mobile true MockTourno
