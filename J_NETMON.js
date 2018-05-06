//# sourceURL=J_NETMON.js
// This program is free software: you can redistribute it and/or modify
// it under the condition that it is for private or home useage and 
// this whole comment is reproduced in the source code file.
// Commercial utilisation is not authorized without the appropriate
// written agreement from amg0 / alexis . mermet @ gmail . com
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 

//-------------------------------------------------------------
// NETMON  Plugin javascript Tabs
//-------------------------------------------------------------
/*
if (typeof String.prototype.format == 'undefined') {
	String.prototype.format = function()
	{
		var args = new Array(arguments.length);

		for (var i = 0; i < args.length; ++i) {
			// `i` is always valid index in the arguments object
			// so we merely retrieve the value
			args[i] = arguments[i];
		}

		return this.replace(/{(\d+)}/g, function(match, number) { 
			return typeof args[number] != 'undefined' ? args[number] : match;
		});
	};
};
*/
var myapi = window.api || null
var NETMON = (function(api,$) {
	var NETMON_Svs = 'urn:upnp-org:serviceId:netmon1';
	jQuery("body").prepend("<style>.NETMON-cls { width:100%; }</style>")

	function isNullOrEmpty(value) {
		return (value == null || value.length === 0);	// undefined == null also
	};
	
	function format(str)
	{
	   var content = str;
	   for (var i=1; i < arguments.length; i++)
	   {
			var replacement = new RegExp('\\{' + (i-1) + '\\}', 'g');	// regex requires \ and assignment into string requires \\,
			// if ($.type(arguments[i]) === "string")
				// arguments[i] = arguments[i].replace(/\$/g,'$');
			content = content.replace(replacement, arguments[i]);  
	   }
	   return content;
	};
	
	//-------------------------------------------------------------
	// Device TAB : Settings
	//-------------------------------------------------------------	

	function NETMON_Settings(deviceID) {
		var credentials = get_device_state(deviceID,  NETMON.NETMON_Svs, 'Credentials',1)
		var map = [
			{ variable:'Debug', id:'netmon-debug', label:'Debug' },
		]
		var html = ""
		var headings = "<tr><th></th><th></th></tr>"
		var fields = [];
		$.each( map, function( idx, item) {
			var value = (item.value!=undefined) ? item.value : get_device_state(deviceID,  NETMON.NETMON_Svs, item.variable,1)
			var editor = ""
			if (item.variable==undefined && item.value==undefined) {
				editor = NETMON.format("<button id='{0}' class='btn btn-secondary btn-sm'>{1}</button>", item.id, item.label)
			} else if (item.value==undefined) {
				editor = NETMON.format("<input id='{0}' value='{1}'></input>",item.id, value)
			} else {
				editor = NETMON.format("<input value='{0}' disabled></input>",value)
			}
			fields.push( 
				NETMON.format('<tr><td>{0}</td><td>{1}</td></tr>',
					NETMON.format("<label for='{0}'>{1}</label>",item.id,item.label),
					editor ) 
				)
		})

		html += NETMON.format("<h3>Parameters</h3><table class='table'><thead>{0}</thead><tbody>{1}</tbody></table>",
			headings,
			fields.join("\n") 
		);
		set_panel_html(html);
		// api.setCpanelContent(html);
		// $("#netmon-save").click( function() {
			// var that = this
			// $.each(map, function(idx,item) {
				// var varVal = jQuery('#'+item.id).val()
				// NETMON.saveVar(deviceID,  NETMON.NETMON_Svs, item.variable, varVal, false)
			// });
		// });
	};
	
	var myModule = {
		NETMON_Svs 	: NETMON_Svs,
		format		: format,
		Dump 		: NETMON_Dump,
		Settings 	: NETMON_Settings,
		
		//-------------------------------------------------------------
		// Helper functions to build URLs to call VERA code from JS
		//-------------------------------------------------------------

		buildAttributeSetUrl : function( deviceID, varName, varValue){
			var urlHead = '' + data_request_url + 'id=variableset&DeviceNum='+deviceID+'&Variable='+varName+'&Value='+varValue;
			return urlHead;
		},

		buildUPnPActionUrl : function(deviceID,service,action,params)
		{
			var urlHead = data_request_url +'id=action&output_format=json&DeviceNum='+deviceID+'&serviceId='+service+'&action='+action;//'&newTargetValue=1';
			if (params != undefined) {
				jQuery.each(params, function(index,value) {
					urlHead = urlHead+"&"+index+"="+value;
				});
			}
			return urlHead;
		},

		buildHandlerUrl: function(deviceID,command,params)
		{
			//http://192.168.1.5:3480/data_request?id=lr_IPhone_Handler
			params = params || []
			var urlHead = data_request_url +'id=lr_NETMON_Handler&command='+command+'&DeviceNum='+deviceID;
			jQuery.each(params, function(index,value) {
				urlHead = urlHead+"&"+index+"="+encodeURIComponent(value);
			});
			return encodeURI(urlHead);
		},

		//-------------------------------------------------------------
		// Variable saving 
		//-------------------------------------------------------------
		saveVar : function(deviceID,  service, varName, varVal, reload) {
			if (service) {
				set_device_state(deviceID, service, varName, varVal, 0);	// lost in case of luup restart
			} else {
				jQuery.get( this.buildAttributeSetUrl( deviceID, varName, varVal) );
			}
		},
		save : function(deviceID, service, varName, varVal, func, reload) {
			// reload is optional parameter and defaulted to false
			if (typeof reload === "undefined" || reload === null) { 
				reload = false; 
			}

			if ((!func) || func(varVal)) {
				this.saveVar(deviceID,  service, varName, varVal, reload)
				jQuery('#NETMON-' + varName).css('color', 'black');
				return true;
			} else {
				jQuery('#NETMON-' + varName).css('color', 'red');
				alert(varName+':'+varVal+' is not correct');
			}
			return false;
		},
		
		get_device_state_async: function(deviceID,  service, varName, func ) {
			// var dcu = data_request_url.sub("/data_request","")	// for UI5 as well as UI7
			var url = data_request_url+'id=variableget&DeviceNum='+deviceID+'&serviceId='+service+'&Variable='+varName;	
			jQuery.get(url)
			.done( function(data) {
				if (jQuery.isFunction(func)) {
					(func)(data)
				}
			})
		},
		
		findDeviceIdx:function(deviceID) 
		{
			//jsonp.ud.devices
			for(var i=0; i<jsonp.ud.devices.length; i++) {
				if (jsonp.ud.devices[i].id == deviceID) 
					return i;
			}
			return null;
		},
		
		goodip : function(ip) {
			// @duiffie contribution
			var reg = new RegExp('^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(:\\d{1,5})?$', 'i');
			return(reg.test(ip));
		},
		
		array2Table : function(arr,idcolumn,viscols,caption,cls,htmlid,bResponsive) {
			var html="";
			var idcolumn = idcolumn || 'id';
			var viscols = viscols || [idcolumn];
			var responsive = ((bResponsive==null) || (bResponsive==true)) ? 'table-responsive-OFF' : ''

			if ( (arr) && ($.isArray(arr) && (arr.length>0)) ) {
				var display_order = [];
				var keys= Object.keys(arr[0]);
				$.each(viscols,function(k,v) {
					if ($.inArray(v,keys)!=-1) {
						display_order.push(v);
					}
				});
				$.each(keys,function(k,v) {
					if ($.inArray(v,viscols)==-1) {
						display_order.push(v);
					}
				});

				var bFirst=true;
				html+= NETMON.format("<table id='{1}' class='table {2} table-sm table-hover table-striped {0}'>",cls || '', htmlid || 'altui-grid' , responsive );
				if (caption)
					html += NETMON.format("<caption>{0}</caption>",caption)
				$.each(arr, function(idx,obj) {
					if (bFirst) {
						html+="<thead>"
						html+="<tr>"
						$.each(display_order,function(_k,k) {
							html+=NETMON.format("<th style='text-transform: capitalize;' data-column-id='{0}' {1} {2}>",
								k,
								(k==idcolumn) ? "data-identifier='true'" : "",
								NETMON.format("data-visible='{0}'", $.inArray(k,viscols)!=-1 )
							)
							html+=k;
							html+="</th>"
						});
						html+="</tr>"
						html+="</thead>"
						html+="<tbody>"
						bFirst=false;
					}
					html+="<tr>"
					$.each(display_order,function(_k,k) {
						html+="<td>"
						html+=(obj[k]!=undefined) ? obj[k] : '';
						html+="</td>"
					});
					html+="</tr>"
				});
				html+="</tbody>"
				html+="</table>";
			}
			else
				html +=NETMON.format("<div>{0}</div>","No data to display")

			return html;		
		}
	}
	return myModule;
})(myapi ,jQuery)

	
//-------------------------------------------------------------
// Device TAB : Donate
//-------------------------------------------------------------	
function NETMON_Donate(deviceID) {
	var htmlDonate='<p>Ce plugin est gratuit mais vous pouvez aider l\'auteur par une donation modique qui sera tres appréciée</p><p>This plugin is free but please consider supporting it by a very appreciated donation to the author.</p>';
	htmlDonate+='<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank"><input type="hidden" name="cmd" value="_donations"><input type="hidden" name="business" value="alexis.mermet@free.fr"><input type="hidden" name="lc" value="FR"><input type="hidden" name="item_name" value="Alexis Mermet"><input type="hidden" name="item_number" value="NETMON"><input type="hidden" name="no_note" value="0"><input type="hidden" name="currency_code" value="EUR"><input type="hidden" name="bn" value="PP-DonationsBF:btn_donateCC_LG.gif:NonHostedGuest"><input type="image" src="https://www.paypalobjects.com/en_US/FR/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"><img alt="" border="0" src="https://www.paypalobjects.com/fr_FR/i/scr/pixel.gif" width="1" height="1"></form>';
	var html = '<div>'+htmlDonate+'</div>';
	set_panel_html(html);
}

