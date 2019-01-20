# NetMonitor
## Network Monitor plugin for VERA

### What does it do
This plugin is enabling you to check the availability of some device on your IP network. it uses ping or http to verify the availability of a device and report it as a Motion Sensor device in VERA
-Tripped:  means the device is not present or fails
-Untripped: means the device is properly responding to the probe

The plugin supports UI5, UI7 and ALTUI , also openluup

### How it compares to others
The big differences with similar plugin ( like the ping sensor ) are that :
1. it is rewritten in a little more modern way ( with a .lua file ) and the main plugin device (NETMON) allows for central configuration. You do not have to create all devices manually.
2. will create automatically child device which are STANDARD Motion sensor devices ( same device type & actions & notifications ) for all your declared devices. 

### Variables
The time between each polling rate is configurable by the PollRate variable and devices are polled in a round robin way. so you are garanteed that the VERA is not over used, but of course the status is only close to real time and it depends on the number of device you monitor.

- ChildrenSameRoom : automatically set by VERA because the device is marked embedded.
- Debug : 0 or 1 according to debug mode ( 1 == debug )
- DevicesOfflineCount : offline devices' count
- DevicesNotification : csv list of tripped device's name ( emits upnp event when changed)
- DevicesStatus : a JSON table of device record, each device record contains tripped status, name, ipaddr
- PollRate : the rate in seconds at which detection probes are run. the plugin goes to each device one by one , so 5 devices with a rate of 10 seconds will take 5x10 = 50 seconds (not counting the wait time for the response)  to circle accross the complete list of devices
- Targets : a JSON internal structure to describe the device targets to monitor. edit it with the Settings screens
- Types : internal , types of probes
- UI7Check : internal, UI7 detected
- Version ! the version of the plugin

NOTE, the NETMON device is a "Embedded" device: meaning that all its children devices will sit and stay in the same room as the main NETMON device. this make it convenient to group all monitor devices in a 'Network' room page for instance.

### Actions
- SetDebug(newDebugMode) :  set debug mode on or off
- GetDevicesStatus()	 :  returns a UPNP action result format with the DeviceStatus value as a content

### Triggers
- on ALTUI and OpenLuup you can use any variable / expression as a trigger
- on classic UI5 UI7 we use triggers.  There is a trigger 'Offline device count goes above/below a certain threshold'

### Future evolutions and architectural flexibility
Also the plugin is architected to be able to add new kind of probes in the future. for now it is either a direct ping to a IP4 address or a http get on a page you can specify ( by default http://ipaddr or if you specific a page it can check http://ipaddr/page ) but I welcome suggestion or contribution for other kind of discovery probes ( could be UDP, UPNP, serial or whatever )


### Installation
The plugin will soon be released in the VERA App Store (http://apps.mios.com/plugin.php?id=9081) but you can find the sources on https://github.com/amg0/NetMonitor
if you use the **AltAppStore** from **ALTUI**, you can install from here.

To install manually, download the files from github , upload them and manually create the device
