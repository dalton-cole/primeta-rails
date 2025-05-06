#!/usr/bin/env ruby
require 'fileutils'

# Path to the server PID file
pid_file = File.join(File.dirname(__FILE__), '..', 'tmp', 'pids', 'server.pid')

if File.exist?(pid_file)
  begin
    pid = File.read(pid_file).to_i
    
    # Check if the process is running
    process_running = Process.kill(0, pid) rescue false
    
    if !process_running
      puts "Removing stale PID file: #{pid_file}"
      FileUtils.rm(pid_file)
    else
      puts "Server is running with PID: #{pid}"
    end
  rescue => e
    puts "Error: #{e.message}"
    puts "Removing PID file to be safe: #{pid_file}"
    FileUtils.rm(pid_file)
  end
else
  puts "No server PID file found."
end 