#!/usr/bin/env perl
use strict;
use warnings;
use IO::Socket::INET;
use File::Basename qw(dirname);
use Cwd qw(abs_path);

my $root = abs_path(dirname(__FILE__));
my $port = $ARGV[0] // 5173;
my $server = IO::Socket::INET->new(
  LocalPort => $port,
  Proto     => 'tcp',
  Reuse     => 1,
  Listen    => 32,
) or die "listen: $!\n";
print "Serving $root on http://127.0.0.1:$port/\n";

my %types = (
  html => 'text/html; charset=utf-8',
  js   => 'text/javascript; charset=utf-8',
  css  => 'text/css; charset=utf-8',
  md   => 'text/markdown; charset=utf-8',
  json => 'application/json',
  png  => 'image/png',
  jpg  => 'image/jpeg',
  svg  => 'image/svg+xml',
  ico  => 'image/x-icon',
  wasm => 'application/wasm',
);

while (my $client = $server->accept()) {
  local $/ = "\r\n";
  my $req = <$client>;
  while (my $h = <$client>) { last if $h eq "\r\n" || $h eq "\n" || !defined $h; }
  my ($method, $path) = $req =~ /^(\S+)\s+(\S+)/;
  $path //= '/';
  $path =~ s/\?.*//;
  $path = '/index.html' if $path eq '/';
  $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/eg;
  my $file = abs_path($root . $path);
  if (!$file || index($file, $root) != 0 || !-f $file) {
    print $client "HTTP/1.0 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: 9\r\nConnection: close\r\n\r\nNot Found";
    close $client; next;
  }
  open my $fh, '<:raw', $file or do {
    print $client "HTTP/1.0 500 Error\r\nConnection: close\r\n\r\n";
    close $client; next;
  };
  local $/; my $body = <$fh>; close $fh;
  my ($ext) = $file =~ /\.([^.]+)$/;
  $ext = lc($ext // '');
  my $ctype = $types{$ext} // 'application/octet-stream';
  my $len = length($body);
  print $client "HTTP/1.0 200 OK\r\nContent-Type: $ctype\r\nContent-Length: $len\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n$body";
  close $client;
}
