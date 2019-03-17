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

var myapi = window.api || null
var NETMON = (function(api,$) {
	
	var NETMON_Svs = 'urn:upnp-org:serviceId:netmon1';
	var splits = jQuery.fn.jquery.split(".");
	var ui5 = (splits[0]=="1" && splits[1]<="5");
	
	jQuery("body").prepend(`
	<style>
	.NETMON-cls { width:100%; }
	.netmon-devicetbl .form-control { padding-left:2px; padding-right:0px; }
	</style>`)

	function isNullOrEmpty(value) {
		return (value == null || value.length === 0);	// undefined == null also
	};
	
	function format(str)
	{
	   var content = str;
	   for (var i=1; i < arguments.length; i++)
	   {
			var replacement = new RegExp('\\{' + (i-1) + '\\}', 'g');	// regex requires \ and assignment into string requires \\,
			// if (jQuery.type(arguments[i]) === "string")
				// arguments[i] = arguments[i].replace(/\$/g,'$');
			content = content.replace(replacement, arguments[i]);  
	   }
	   return content;
	};
	
	//-------------------------------------------------------------
	// Device TAB : Settings
	//-------------------------------------------------------------	

	function NETMON_Settings(deviceID) {
		function _buildTypesSelect(id,selected) {
			var result = NETMON.format('<select id="{0}" class="form-control netmon-select-type">{1}</select>',id,
				jQuery.map(types, function(type) {
					return NETMON.format('<option {1}>{0}</option>',type,(type,selected==type) ? 'selected' : '')
				}))
			return result
		};
		function _buildTargetLineHtml(target) {
			var type = _buildTypesSelect('netmon-type',target.type)
			var name = NETMON.format("<input class='form-control' id='netmon-name' value='{0}' required></input>",target.name)
			var ipaddr = NETMON.format("<input class='form-control' id='netmon-ipaddr' value='{0}' required></input>",target.ipaddr || "")
			var page = NETMON.format("<input class='form-control {1}' id='netmon-page' value='{0}'></input>",target.page || "", (target.type=='http') ? '' : 'hidden d-none')
			var inverted = NETMON.format("<input type='checkbox' class='form-control' id='netmon-inverted' {0}></input>", (target.inverted==1) ? 'checked' : '')
			var btn_del = NETMON.format(btnTemplate,'netmon-del','Delete','fa fa-trash-o text-danger','btn-sm netmon-del')
			return NETMON.format('<tr><td>{0}</td> <td>{1}</td> <td>{2}</td> <td>{3}</td> <td>{4}</td> <td>{5}</td></tr>',
				name,
				type,
				ipaddr,
				page,
				inverted,
				btn_del
			);
		};
		function _getTargetFromLine(row) {
			var name =  jQuery(row).find("input#netmon-name").val()
			var target = {
				name: name,
				type: jQuery(row).find("#netmon-type").val(),
				ipaddr: jQuery(row).find("#netmon-ipaddr").val(),
				inverted: jQuery(row).find("#netmon-inverted").is(":checked") ? 1 : 0,
				// success: false
			}
			var bool = jQuery(row).find("#netmon-page").hasClass("d-none") || jQuery(row).find("#netmon-page").hasClass("hidden")
			if (bool == false) {
				target.page = jQuery(row).find("#netmon-page").val()
			}
			return target
		}

		var map = [
			{ variable:'PollRate', id:'netmon-pollrate', label:'Max Poll Rate (sec)' },
		];
		var html = ""
		var headings = ""; // "<tr><th></th><th></th></tr>"
		var fields = [];

		var mytargets = JSON.parse(get_device_state(deviceID,  NETMON.NETMON_Svs, 'Targets',1))
		var types = JSON.parse( get_device_state(deviceID,  NETMON.NETMON_Svs, 'Types',1))

		jQuery.each( map, function( idx, item) {
			var value = (item.value!=undefined) ? item.value : get_device_state(deviceID,  NETMON.NETMON_Svs, item.variable,1)
			var editor = ""
			if (item.variable==undefined && item.value==undefined) {
				editor = NETMON.format("<button id='{0}' class='btn btn-secondary btn-sm'>{1}</button>", item.id, item.label)
			} else if (item.value==undefined) {
				editor = NETMON.format("<input class='form-control' id='{0}' value='{1}'></input>",item.id, value)
			} else {
				editor = NETMON.format("<input class='form-control' value='{0}' disabled></input>",value)
			}
			fields.push( 
				NETMON.format('<tr><td>{0}</td><td>{1}</td></tr>',
					NETMON.format("<label for='{0}'><b>{1}</b> :</label>",item.id,item.label),
					editor ) 
				)
		});
		
		html += NETMON.format("<h3>Parameters</h3><table class='table table-responsive table-sm'><thead>{0}</thead><tbody>{1}</tbody></table>",
			headings,
			fields.join("\n") 
		);

		fields=[];

		var btnTemplate = '<button id="{0}" type="button" class="btn btn-light {3}" title="{1}"><i class="{2}" aria-hidden="true" title="{1}"></i> {1}</button>'
		var btn_add = NETMON.format(btnTemplate,'add','Add','fa fa-plus','netmon-add')
		html += '<form action="javascript:void(0);"><table class="table table-responsive table-sm netmon-devicetbl">'
		html += '<thead>'
		html += '<tr><th>Name</th> <th>Type</th> <th>IPAddr</th> <th>Page</th> <th>Inverted</th> <th>Action</th> </tr>'
		html += '</thead>'
		html += '<tbody>'
		jQuery.each(mytargets.sort(sortByName), function(idx,target) {
			html += _buildTargetLineHtml(target)
		});
		html += '</tbody>'
		html += '</table>'
		html += btn_add;
		html += "<button id='netmon-save' type='submit' class='btn btn-primary'>Save and Reload</button>"
		// set_panel_html(html);
		html += "<form>"
		// api.setCpanelContent(html);
		set_panel_html(html);
		
		function _onChangeType(e) {
			var row = jQuery(this).closest("tr")
			var target = _getTargetFromLine(row)
			jQuery(row).replaceWith( _buildTargetLineHtml(target) ) 		
		}
		function _onDelLine(e) {
			var id = (ui5==true) ? jQuery(this).attr('id') : jQuery(this).prop('id')
			id = id.substring('del-'.length)
			var tr = jQuery(this).closest("tr").remove()
		}
		function _onAddLine(e) {
			var target = {
				name: '',
				type:'ping',
				ipaddr:"",
				inverted:'',
				page:""
			}
			var html = _buildTargetLineHtml(target) 
			jQuery(".netmon-devicetbl").append( html )
		}
		function _onSave(e) {
			var form = jQuery(this).closest("form")[0]
			if (form.checkValidity() === false) {
				event.preventDefault();
				event.stopPropagation();
				alert("The form has some invalid values")
			} else {
				var that = this
				jQuery.each(map, function(idx,item) {
					var varVal = jQuery('#'+item.id).val()
					NETMON.saveVar(deviceID,  NETMON.NETMON_Svs, item.variable, varVal, false)
				});
				var targets = []
				jQuery(".netmon-devicetbl tbody tr").each( function(i,row) {
					var target = _getTargetFromLine(row)
					if ((target.name.length>0) && (target.ipaddr.length>0))
						targets.push( target )
				});
				NETMON.saveVar(deviceID,  NETMON.NETMON_Svs, 'Targets', JSON.stringify(targets),(ui5==false))
				alert((ui5==false) ? "Reloading Luup engine ... " : "Save your changes")
			}
			form.classList.add('was-validated');
		}
		
		jQuery(".netmon-add").click( _onAddLine );
		jQuery("#netmon-save").click( _onSave );
		if (ui5) {
			jQuery(".netmon-devicetbl")
				.undelegate()
				.delegate('.netmon-select-type','change', _onChangeType)
				.delegate('.netmon-del','click', _onDelLine)				
			
		} else {
			jQuery(".netmon-devicetbl")
				.off('click')
				.on('change','.netmon-select-type', _onChangeType )
				.on('click','.netmon-del', _onDelLine );
		}
	};
	
	function NETMON_Status(deviceID) {
		function sortByStatusAndName(a,b) {
			// if (a.success > b.success)
				// return 1
			// if (a.success < b.success)
				// return -1
			if (a.name == b.name)
				return 0
			return (a.name < b.name) ? -1 : 1
		}
		function getHtml(data) {
			var model = jQuery.map( data, function(target,ipaddr) {
				var statusTpl = "<span class={1}>{0}</span>"
				return {
					name: target.name,
					ipaddr: ipaddr,
					status: (target.success != true)
						? ("<b>"+NETMON.format( statusTpl, 'off-line' ,'text-danger' )+"</b>")
						: NETMON.format( statusTpl, 'on-line' ,'text-success' ),
					test: NETMON.format('<button type="button" class="btn btn-outline-primary btn-sm montool-test-btn" data-ip="{0}">Test</button>',ipaddr)
				}
			});
			return NETMON.array2Table(model.sort( sortByStatusAndName ),'name',[],'','montool-statustbl','montool-statustbl0',false)
		}
		var data = JSON.parse( get_device_state(deviceID,  NETMON.NETMON_Svs, 'DevicesStatus',1))
		var html = getHtml(data);
		set_panel_html(html);
		
		function _onClickTest(e) {
			var ip = $(this).data("ip")
			var url = NETMON.buildUPnPActionUrl(deviceID,NETMON.NETMON_Svs,"TestDevice",{ipaddr:ip})
			jQuery.get( url )
			.done(function( result ) {
				var success = (jQuery.isPlainObject(result)==true) ? "Online" : "Offline" ;
				jQuery.get(  NETMON.buildUPnPActionUrl(deviceID,NETMON.NETMON_Svs,"GetDevicesStatus") )
				.done( function( result2) {
					var data = JSON.parse( result2["u:GetDevicesStatusResponse"].DevicesStatus );
					var html = getHtml(data);
					jQuery("table.montool-statustbl").replaceWith( html );
				})
				alert(success);
			})			
		};
		
		jQuery(".montool-statustbl").parent()
				.off('click')
				.on('click','.montool-test-btn',_onClickTest)
				
		// api.setCpanelContent(html);
	};
	
	var myModule = {
		NETMON_Svs 	: NETMON_Svs,
		format		: format,
		Settings 	: NETMON_Settings,
		Status 		: NETMON_Status,
		
		//-------------------------------------------------------------
		// Helper functions to build URLs to call VERA code from JS
		//-------------------------------------------------------------

		buildReloadUrl : function() {
			var urlHead = '' + data_request_url + 'id=reload';
			return urlHead;
		},
		
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
			if (reload==true) {
				jQuery.get(this.buildReloadUrl())
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

			if ( (arr) && (jQuery.isArray(arr) && (arr.length>0)) ) {
				var display_order = [];
				var keys= Object.keys(arr[0]);
				jQuery.each(viscols,function(k,v) {
					if (jQuery.inArray(v,keys)!=-1) {
						display_order.push(v);
					}
				});
				jQuery.each(keys,function(k,v) {
					if (jQuery.inArray(v,viscols)==-1) {
						display_order.push(v);
					}
				});

				var bFirst=true;
				html+= NETMON.format("<table id='{1}' class='table {2} table-sm table-hover table-striped {0}'>",cls || '', htmlid || 'altui-grid' , responsive );
				if (caption)
					html += NETMON.format("<caption>{0}</caption>",caption)
				jQuery.each(arr, function(idx,obj) {
					if (bFirst) {
						html+="<thead>"
						html+="<tr>"
						jQuery.each(display_order,function(_k,k) {
							html+=NETMON.format("<th style='text-transform: capitalize;' data-column-id='{0}' {1} {2}>",
								k,
								(k==idcolumn) ? "data-identifier='true'" : "",
								NETMON.format("data-visible='{0}'", jQuery.inArray(k,viscols)!=-1 )
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
					jQuery.each(display_order,function(_k,k) {
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
function NETMON_Settings (deviceID) {
	return NETMON.Settings(deviceID)
}

function NETMON_Status (deviceID) {
	return NETMON.Status(deviceID)
}
		
function NETMON_Donate(deviceID) {
	var htmlDonate='<p>Ce plugin est gratuit mais vous pouvez aider l\'auteur par une donation modique qui sera tres appréciée</p><p>This plugin is free but please consider supporting it by a very appreciated donation to the author.</p>';
	htmlDonate+='<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank"><input type="hidden" name="cmd" value="_donations"><input type="hidden" name="business" value="alexis.mermet@free.fr"><input type="hidden" name="lc" value="FR"><input type="hidden" name="item_name" value="Alexis Mermet"><input type="hidden" name="item_number" value="NETMON"><input type="hidden" name="no_note" value="0"><input type="hidden" name="currency_code" value="EUR"><input type="hidden" name="bn" value="PP-DonationsBF:btn_donateCC_LG.gif:NonHostedGuest"><input type="image" src="https://www.paypalobjects.com/en_US/FR/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"><img alt="" border="0" src="https://www.paypalobjects.com/fr_FR/i/scr/pixel.gif" width="1" height="1"></form>';
	var html = '<div>'+htmlDonate+'</div>';
	set_panel_html(html);
}

