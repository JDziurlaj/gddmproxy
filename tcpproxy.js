var replace = require('buffer-replace');
var net = require("net");
var EBCDIC = require('nm-ebcdic-converter');

process.on("uncaughtException", function (error) {
  console.error(error);
});

if (process.argv.length != 5) {
  console.log("usage: %s <localport> <remotehost> <remoteport>", process.argv[1]);
  process.exit();
}

var localport = process.argv[2];
var remotehost = process.argv[3];
var remoteport = process.argv[4];

var server = net.createServer(function (localsocket) {
  var remotesocket = new net.Socket();

  remotesocket.connect(remoteport, remotehost);

  localsocket.on('connect', function (data) {
    console.log(">>> connection #%d from %s:%d",
      server.connections,
      localsocket.remoteAddress,
      localsocket.remotePort
    );
  });

  localsocket.on('data', function (data) {
    console.log("%s:%d - writing data to remote",
      localsocket.remoteAddress,
      localsocket.remotePort
    );
    
    //compare buffer to find query response   
    //look for pattern that indicates the Query command
    // see https://tools.ietf.org/html/rfc1205 
    let queryHeader = Buffer.from([0x00, 0x00, 0x88, 0x00, 0x3A, 0xD9, 0x70, 0x80]);
    let copiedData = Buffer.from(data);
    if (copiedData.length > 0x12) {
      if (copiedData.subarray(0x0A, 0x12).equals(queryHeader)) {
        console.log("replacing query response");
        // offset -11 from RFC 1205 documentation
        copiedData[0x28] = Number("0x" + EBCDIC.fromASCII('5'));
        copiedData[0x29] = Number("0x" + EBCDIC.fromASCII('2'));
        copiedData[0x2A] = Number("0x" + EBCDIC.fromASCII('9'));
        copiedData[0x2B] = Number("0x" + EBCDIC.fromASCII('2'));
        copiedData[0x2C] = Number("0x" + EBCDIC.fromASCII('0'));
        copiedData[0x2D] = Number("0x" + EBCDIC.fromASCII('0'));
        copiedData[0x2E] = Number("0x" + EBCDIC.fromASCII('1'));
        // set byte 53 to 5292-2 style graphics
        copiedData[0x3E] = 0b1;
      }
    }
    // replace this anywhere it is seen, likely in TERMINAL-TYPE response
    let replaceBuffer = replace(copiedData, 'IBM-3179-2', 'IBM-5292-2');
    console.log("sending");
    console.log(replaceBuffer);
    let flushed = remotesocket.write(replaceBuffer);

    if (!flushed) {
      console.log("  remote not flushed; pausing local");
      localsocket.pause();
    }
  });

  remotesocket.on('data', function (data) {
    console.log("%s:%d - writing data to local",
      localsocket.remoteAddress,
      localsocket.remotePort
    );
    let flushed = localsocket.write(data);
    if (!flushed) {
      console.log("  local not flushed; pausing remote");
      remotesocket.pause();
    }
  });

  localsocket.on('drain', function () {
    console.log("%s:%d - resuming remote",
      localsocket.remoteAddress,
      localsocket.remotePort
    );
    remotesocket.resume();
  });

  remotesocket.on('drain', function () {
    console.log("%s:%d - resuming local",
      localsocket.remoteAddress,
      localsocket.remotePort
    );
    localsocket.resume();
  });

  localsocket.on('close', function (had_error) {
    console.log("%s:%d - closing remote",
      localsocket.remoteAddress,
      localsocket.remotePort
    );
    remotesocket.end();
  });

  remotesocket.on('close', function (had_error) {
    console.log("%s:%d - closing local",
      localsocket.remoteAddress,
      localsocket.remotePort
    );
    localsocket.end();
  });

});

server.listen(localport);

console.log("redirecting connections from 127.0.0.1:%d to %s:%d", localport, remotehost, remoteport);