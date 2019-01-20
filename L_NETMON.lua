-- // This program is free software: you can redistribute it and/or modify
-- // it under the condition that it is for private or home useage and
-- // this whole comment is reproduced in the source code file.
-- // Commercial utilisation is not authorized without the appropriate
-- // written agreement from amg0 / alexis . mermet @ gmail . com
-- // This program is distributed in the hope that it will be useful,
-- // but WITHOUT ANY WARRANTY; without even the implied warranty of
-- // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE .
local MSG_CLASS		= "NETMON"
local NETMON_SERVICE	= "urn:upnp-org:serviceId:netmon1"
local devicetype	= "urn:schemas-upnp-org:device:netmon:1"
-- local this_device	= nil
local DEBUG_MODE	= false -- controlled by UPNP action
local version		= "v0.5"
local JSON_FILE = "D_NETMON.json"
local UI7_JSON_FILE = "D_NETMON_UI7.json"

local json = require("dkjson")
local mime = require('mime')
local socket = require("socket")
local http = require("socket.http")
local https = require ("ssl.https")
local ltn12 = require("ltn12")
local modurl = require ("socket.url")

local vartable = {
	"urn:micasaverde-com:serviceId:SecuritySensor1,Tripped=0",
	"urn:micasaverde-com:serviceId:SecuritySensor1,Armed=0"
}

local active_target = 0 -- 0 to modulo targets length

------------------------------------------------
-- Debug --
------------------------------------------------
function log(text, level)
  luup.log(string.format("%s: %s", MSG_CLASS, text), (level or 50))
end

function debug(text)
  if (DEBUG_MODE) then
	log("debug: " .. text)
  end
end

function warning(stuff)
  log("warning: " .. stuff, 2)
end

function error(stuff)
  log("error: " .. stuff, 1)
end

local function isempty(s)
  return s == nil or s == ""
end

------------------------------------------------
-- VERA Device Utils
------------------------------------------------
local function getParent(lul_device)
  return luup.devices[lul_device].device_num_parent
end

local function getAltID(lul_device)
  return luup.devices[lul_device].id
end

-----------------------------------
-- from a altid, find a child device
-- returns 2 values
-- a) the index === the device ID
-- b) the device itself luup.devices[id]
-----------------------------------
local function findChild( lul_parent, altid )
  -- debug(string.format("findChild(%s,%s)",lul_parent,altid))
  for k,v in pairs(luup.devices) do
	if( getParent(k)==lul_parent) then
	  if( v.id==altid) then
		return k,v
	  end
	end
  end
  return nil,nil
end

local function getParent(lul_device)
  return luup.devices[lul_device].device_num_parent
end

local function getRoot(lul_device)
  while( getParent(lul_device)>0 ) do
	lul_device = getParent(lul_device)
  end
  return lul_device
end

------------------------------------------------
-- Device Properties Utils
------------------------------------------------
local function getSetVariable(serviceId, name, deviceId, default)
  local curValue = luup.variable_get(serviceId, name, deviceId)
  if (curValue == nil) then
	curValue = default
	luup.variable_set(serviceId, name, curValue, deviceId)
  end
  return curValue
end

local function getSetVariableIfEmpty(serviceId, name, deviceId, default)
  local curValue = luup.variable_get(serviceId, name, deviceId)
  if (curValue == nil) or (curValue:trim() == "") then
	curValue = default
	luup.variable_set(serviceId, name, curValue, deviceId)
  end
  return curValue
end

local function setVariableIfChanged(serviceId, name, value, deviceId)
  debug(string.format("setVariableIfChanged(%s,%s,%s,%s)",serviceId, name, value or 'nil', deviceId))
  local curValue = luup.variable_get(serviceId, name, tonumber(deviceId)) or ""
  value = value or ""
  if (tostring(curValue)~=tostring(value)) then
	luup.variable_set(serviceId, name, value or '', tonumber(deviceId))
  end
end

local function setAttrIfChanged(name, value, deviceId)
  debug(string.format("setAttrIfChanged(%s,%s,%s)",name, value or 'nil', deviceId))
  local curValue = luup.attr_get(name, deviceId)
  if ((value ~= curValue) or (curValue == nil)) then
	luup.attr_set(name, value or '', deviceId)
	return true
  end
  return value
end

local function getIP()
  -- local stdout = io.popen("GetNetworkState.sh ip_wan")
  -- local ip = stdout:read("*a")
  -- stdout:close()
  -- return ip
  local mySocket = socket.udp ()
  mySocket:setpeername ("42.42.42.42", "424242")  -- arbitrary IP/PORT
  local ip = mySocket:getsockname ()
  mySocket: close()
  return ip or "127.0.0.1"
end

------------------------------------------------
-- Tasks
------------------------------------------------
local taskHandle = -1
local TASK_ERROR = 2
local TASK_ERROR_PERM = -2
local TASK_SUCCESS = 4
local TASK_BUSY = 1

--
-- Has to be "non-local" in order for MiOS to call it :(
--
local function task(text, mode)
  if (mode == TASK_ERROR_PERM)
  then
	error(text)
  elseif (mode ~= TASK_SUCCESS)
  then
	warning(text)
  else
	log(text)
  end
  
  if (mode == TASK_ERROR_PERM)
  then
	taskHandle = luup.task(text, TASK_ERROR, MSG_CLASS, taskHandle)
  else
	taskHandle = luup.task(text, mode, MSG_CLASS, taskHandle)

	-- Clear the previous error, since they're all transient
	if (mode ~= TASK_SUCCESS)
	then
	  luup.call_delay("clearTask", 15, "", false)
	end
  end
end

function clearTask()
  task("Clearing...", TASK_SUCCESS)
end

local function UserMessage(text, mode)
  mode = (mode or TASK_ERROR)
  task(text,mode)
end

------------------------------------------------
-- LUA Utils
------------------------------------------------
local function Split(str, delim, maxNb)
  -- Eliminate bad cases...
  if string.find(str, delim) == nil then
	return { str }
  end
  if maxNb == nil or maxNb < 1 then
	maxNb = 0	 -- No limit
  end
  local result = {}
  local pat = "(.-)" .. delim .. "()"
  local nb = 0
  local lastPos
  for part, pos in string.gmatch(str, pat) do
	nb = nb + 1
	result[nb] = part
	lastPos = pos
	if nb == maxNb then break end
  end
  -- Handle the last field
  if nb ~= maxNb then
	result[nb + 1] = string.sub(str, lastPos)
  end
  return result
end

-- function string:split(sep) -- from http://lua-users.org/wiki/SplitJoin	 : changed as consecutive delimeters was not returning empty strings
  -- return Split(self, sep)
-- end

function string:template(variables)
  return (self:gsub('@(.-)@',
	function (key)
	  return tostring(variables[key] or '')
	end))
end

function string:trim()
  return self:match "^%s*(.-)%s*$"
end

local function tablelength(T)
  local count = 0
  if (T~=nil) then
  for _ in pairs(T) do count = count + 1 end
  end
  return count
end


------------------------------------------------------------------------------------------------
-- Http handlers : Communication FROM ALTUI
-- http://192.168.1.5:3480/data_request?id=lr_NETMON_Handler&command=xxx
-- recommended settings in ALTUI: PATH = /data_request?id=lr_NETMON_Handler&mac=$M&deviceID=114
------------------------------------------------------------------------------------------------
function getDevicesStatus(lul_device)
	debug( string.format("getDevicesStatus(%s)",lul_device))
	local js = luup.variable_get(NETMON_SERVICE, "Targets", lul_device)
	local targets = json.decode(js)
	local result = {}
	local deviceNotice = ""
	local count = 0
	for k,device_def in pairs(targets) do
		local lul_child,device = findChild( lul_device, 'child_'.. device_def.ipaddr )
		local tripped = luup.variable_get('urn:micasaverde-com:serviceId:SecuritySensor1', 'Tripped', lul_child)
		if (tripped=="1") then
			count = count +1 
			 if count == 1 then
			 	 deviceNotice =  device_def.name 
				 else
				 deviceNotice = deviceNotice ..", ".. device_def.name 
			 end
		end
		table.insert(result, {
			name = device_def.name,
			ipaddr = device_def.ipaddr,
			tripped = tripped
		})
	end
	setVariableIfChanged(NETMON_SERVICE, "DevicesNotification", deviceNotice, lul_device)
	setVariableIfChanged(NETMON_SERVICE, "DevicesStatus", json.encode(result), lul_device)
	setVariableIfChanged(NETMON_SERVICE, "DevicesOfflineCount", count, lul_device)
	return result
end

local function switch( command, actiontable)
  -- check if it is in the table, otherwise call default
  if ( actiontable[command]~=nil ) then
	return actiontable[command]
  end
  warning("NETMON_Handler:Unknown command received:"..command.." was called. Default function")
  return actiontable["default"]
end

function myNETMON_Handler(lul_request, lul_parameters, lul_outputformat)
  debug('myNETMON_Handler: request is: '..tostring(lul_request))
  debug('myNETMON_Handler: parameters is: '..json.encode(lul_parameters))
  local lul_html = "";	-- empty return by default
  local mime_type = "";
  -- if (hostname=="") then
	-- hostname = getIP()
	-- debug("now hostname="..hostname)
  -- end

  -- find a parameter called "command"
  if ( lul_parameters["command"] ~= nil ) then
	command =lul_parameters["command"]
  else
	  debug("NETMON_Handler:no command specified, taking default")
	command ="default"
  end

  local deviceID = tonumber( lul_parameters["DeviceNum"] ) -- or findTHISDevice() )

  -- switch table
  local action = {

	  ["default"] =
	  function(params)
		return "default handler / not successful", "text/plain"
	  end,

	  ["getStatus"]= 
	  function(params)
		local res = getDevicesStatus(deviceID)
		local str = json.encode(res)
		debug( string.format("result=%s", str) )
		return str,"application/json"
	  end
  }
  -- actual call
  lul_html , mime_type = switch(command,action)(lul_parameters)
  if (command ~= "home") and (command ~= "oscommand") then
	debug(string.format("lul_html:%s",lul_html or ""))
  end
  return (lul_html or "") , mime_type
end

------------------------------------------------
-- UPNP actions Sequence
------------------------------------------------
local function UserSetArmed(lul_device,newArmedValue)
	debug(string.format("UserSetArmed(%s,%s)",lul_device,newArmedValue))
	lul_device = tonumber(lul_device)
	newArmedValue = tonumber(newArmedValue)
	return luup.variable_set("urn:micasaverde-com:serviceId:SecuritySensor1", "Armed", newArmedValue, lul_device)
end

function pingDevice(device_def)
	debug(string.format("pingDevice(%s) %s",device_def.ipaddr,"ping -c 1 -w 3 " .. device_def.ipaddr))
	local returnCode = os.execute("ping -c 1 -w 3 " .. device_def.ipaddr) 
	return (returnCode == 0)	-- 0 is good,  other is failure
end

function httpDevice(device_def)
	debug(string.format("httpDevice(%s)",device_def.ipaddr))
	local newUrl = string.format("http://%s/%s",device_def.ipaddr,device_def.page)
	debug(string.format("GET url %s",newUrl))
	local code,data,httpcode = luup.inet.wget(newUrl,10)
	debug(string.format("wget %s returned code:%s httpcode:%s data:%s",newUrl,code, httpcode,string.sub(data or "",1,100) ))
	-- 0 or 401 are fine, it means http responded so the device is online
	-- on vera, a 401 return could create a httpcode == -1 but data contains something
	if ((code==0) or (httpcode==200) or (httpcode==302) or (httpcode==401) or (httpcode==403) ) then
		return true
	end
	warning(string.format("failed to wget to %s, http.request returned %d", newUrl,httpcode))
	return false
end

local discovery_func = {
	["ping"] = pingDevice,
	["http"] = httpDevice,	
}

local function refreshOneDevice(lul_device,device_def)
	debug(string.format("refreshOneDevice(%s,%s)",lul_device,json.encode(device_def)))
	local success = false
	if (device_def ~= nil) then
		success = (discovery_func[ device_def.type ])(device_def) 
		if (success==false) then
			warning(string.format("Device %s did not respond properly to %s probe",device_def.ipaddr,json.encode(device_def)))
		else
			debug("success")
		end
		-- todo
		local lul_child,device = findChild( lul_device, 'child_'.. device_def.ipaddr )
		setVariableIfChanged('urn:micasaverde-com:serviceId:SecuritySensor1', 'Tripped', (success==false) and "1" or "0", lul_child)
	end
	return success
end

function refreshDevices(lul_device,no_refresh)
	debug(string.format("refreshDevices(%s)",lul_device))
	lul_device = tonumber(lul_device)
	norefresh = norefresh or false
	local js = luup.variable_get(NETMON_SERVICE, "Targets", lul_device)
	local targets = json.decode(js)
	local success = refreshOneDevice(lul_device, targets[ active_target+1 ])
	active_target = (active_target+1) % #targets

	-- refresh stats
	getDevicesStatus(lul_device)

	if (norefresh==false) then
		local period  = getSetVariable(NETMON_SERVICE, "PollRate", lul_device, 10)
		period = tonumber(period)
		debug(string.format("programming next refreshDevices(%s) in %s sec",lul_device,period))
		luup.call_delay("refreshDevices",period,tostring(lul_device))
	end
	return true	-- would be false if there is an error, but a failed discovery device is not an error
end

------------------------------------------------
-- UPNP Actions Sequence
------------------------------------------------
local function setDebugMode(lul_device,newDebugMode)
  lul_device = tonumber(lul_device)
  newDebugMode = tonumber(newDebugMode) or 0
  debug(string.format("setDebugMode(%d,%d)",lul_device,newDebugMode))
  luup.variable_set(NETMON_SERVICE, "Debug", newDebugMode, lul_device)
  if (newDebugMode==1) then
	DEBUG_MODE=true
  else
	DEBUG_MODE=false
  end
end

local function UpnpTestDevice(lul_device,ipaddr)
	lul_device = tonumber(lul_device)
	local js = luup.variable_get(NETMON_SERVICE, "Targets", lul_device)
	local targets = json.decode(js)
	local found_device_index = 0
	local success = false
	for k,device_def in pairs(targets) do
		if (device_def.ipaddr==ipaddr) then
			success = refreshOneDevice(lul_device, device_def)
			-- refresh stats
			getDevicesStatus(lul_device)
		end
	end
	return success
end

local function SyncDevices(lul_device)	 
	debug(string.format("SyncDevices(%s)",lul_device))
	local js = luup.variable_get(NETMON_SERVICE, "Targets", lul_device)
	local targets = json.decode(js)
	debug(string.format("Devices to Monitor: %s",js))
	if (targets~=nil) then
		local child_devices = luup.chdev.start(lul_device);
		for k,v in pairs(targets) do
			local idx = tonumber(k)
			luup.chdev.append(
				lul_device, child_devices,
				'child_'..v.ipaddr,			-- altid
				v.name,						-- device name
				'urn:schemas-micasaverde-com:device:MotionSensor:1',				-- children device type
				'D_MotionSensor1.xml',		-- children D-file
				"", 						-- children I-file
				table.concat(vartable, "\n"),			-- params
				true,						-- not embedded
				false						-- invisible
			)
		end
		luup.chdev.sync(lul_device, child_devices)	
	else
		error(string.format("empty targets or bad json format:%s",js))
		return false
	end
	return true
end

local function startEngine(lul_device)
	debug(string.format("startEngine(%s)",lul_device))
	lul_device = tonumber(lul_device)
	local success =  SyncDevices(lul_device) and refreshDevices(lul_device)
	return success
end

function startupDeferred(lul_device)
	lul_device = tonumber(lul_device)
	log("startupDeferred, called on behalf of device:"..lul_device)

	local debugmode = getSetVariable(NETMON_SERVICE, "Debug", lul_device, "0")
	local oldversion = getSetVariable(NETMON_SERVICE, "Version", lul_device, "")
	local pollrate = getSetVariable(NETMON_SERVICE, "PollRate", lul_device, 10)
	local targets = getSetVariable(NETMON_SERVICE, "Targets", lul_device, "[]")
	local ds = getSetVariable(NETMON_SERVICE, "DevicesStatus", lul_device, "[]")
	local dsc = getSetVariable(NETMON_SERVICE, "DevicesOfflineCount", lul_device, 0)
    local dsn = getSetVariable(NETMON_SERVICE, "DevicesNotification", lul_device, "")
	
	local types = {}
	for k,v in pairs(discovery_func) do
		table.insert(types,k)
	end
	setVariableIfChanged(NETMON_SERVICE, "Types", json.encode(types), lul_device)
	
	-- local zz = getSetVariable(NETMON_SERVICE, "Targets", lul_device, "")
	
	if (debugmode=="1") then
		DEBUG_MODE = true
		UserMessage("Enabling debug mode for device:"..lul_device,TASK_BUSY)
	end
	local major,minor = 0,0
	local tbl={}

	if (oldversion~=nil) then
		if (oldversion ~= "") then
		  major,minor = string.match(oldversion,"v(%d+)%.(%d+)")
		  major,minor = tonumber(major),tonumber(minor)
		  debug ("Plugin version: "..version.." Device's Version is major:"..major.." minor:"..minor)

		  newmajor,newminor = string.match(version,"v(%d+)%.(%d+)")
		  newmajor,newminor = tonumber(newmajor),tonumber(newminor)
		  debug ("Device's New Version is major:"..newmajor.." minor:"..newminor)

		  -- force the default in case of upgrade
		  if ( (newmajor>major) or ( (newmajor==major) and (newminor>minor) ) ) then
			-- log ("Version upgrade => Reseting Plugin config to default")
		  end
		else
		  log ("New installation")
		end
		luup.variable_set(NETMON_SERVICE, "Version", version, lul_device)
	end

	luup.register_handler('myNETMON_Handler','NETMON_Handler')
	
	local success = startEngine(lul_device)

	-- report success or failure
	if( luup.version_branch == 1 and luup.version_major == 7) then
		if (success == true) then
			luup.set_failure(0,lul_device)  -- should be 0 in UI7
		else
			luup.set_failure(1,lul_device)  -- should be 0 in UI7
		end
	else
		luup.set_failure(false,lul_device)	-- should be 0 in UI7
	end

	log("startup completed")
end

------------------------------------------------
-- Check UI7
------------------------------------------------
local function checkVersion(lul_device)
  local ui7Check = luup.variable_get(NETMON_SERVICE, "UI7Check", lul_device) or ""
  if ui7Check == "" then
	luup.variable_set(NETMON_SERVICE, "UI7Check", "false", lul_device)
	ui7Check = "false"
  end
  if( luup.version_branch == 1 and luup.version_major == 7) then
	if (ui7Check == "false") then
		-- first & only time we do this
		luup.variable_set(NETMON_SERVICE, "UI7Check", "true", lul_device)
		luup.attr_set("device_json", UI7_JSON_FILE, lul_device)
		luup.reload()
	end
  else
	-- UI5 specific
  end
end

function initstatus(lul_device)
  lul_device = tonumber(lul_device)
  -- this_device = lul_device
  log("initstatus("..lul_device..") starting version: "..version)
  checkVersion(lul_device)
  -- hostname = getIP()
  local delay = 1	-- delaying first refresh by x seconds
  debug("initstatus("..lul_device..") startup for Root device, delay:"..delay)
  luup.call_delay("startupDeferred", delay, tostring(lul_device))
end

-- do not delete, last line must be a CR according to MCV wiki page
