DBWidgets = {};


DBWidgets.toolbarController = {
    widgetsList: ko.observable([{'id': 'tripleCounter', 'label':'Triple Counter'},
                                {'id': 'about', 'label': 'About'},
                                {'id': 'location', 'label': 'Geo Location'},
                                {'id': 'depiction', 'label': 'Depiction'},
                                {'id': 'age', 'label': 'Age'},
                                {'id': 'abstract', 'label': 'Abstract'}]),

    classesList: {'ObjectUnionOf(ObjectSomeValuesFrom([foaf:depiction]),ObjectSomeValuesFrom(<http://dbpedia.org/ontology/thumbnail>))':
                  {'depiction': function(){ 
                                  if(this.prop("[foaf:depiction]")) { 
                                      return sko.plainUri(this.getProp("[foaf:depiction]"));
                                  } else { 
                                      return sko.plainUri(this.getProp("<http://dbpedia.org/ontology/thumbnail>"));
                                  } 
                              }},
                  'ObjectUnionOf(ObjectSomeValuesFrom([dbontology:birthDate]),ObjectSomeValuesFrom([dbprop:dateOfBirth]))':
                  {'age': function() {
                       try {
                           if(this.prop("[dbprop:dateOfBirth]") && 
                              this.getProp("[dbprop:dateOfBirth]") &&
                              this.getProp("[dbprop:dateOfBirth]").indexOf("-") != -1) {
                               var year = this.getProp("[dbprop:dateOfBirth]").split("-")[0];
                               year = parseInt(year);
                               var currentYear = 1900+(new Date().getYear());
                               return ""+(currentYear-year)+" years";
                           } else if(this.prop("[dbontology:birthDate]")) {
                               var year = this.getProp("[dbontology:birthDate]").split("-")[0];
                               year = parseInt(year);
                               var currentYear = 1900+(new Date().getYear());
                               return ""+(currentYear-year)+" years";
                           } else {
                               return "--";
                           }
                       } catch (x) {
                           return "--";
                       }
                  }},
                  'ObjectUnionOf(ObjectSomeValuesFrom([dbontology:abstract]), ObjectSomeValuesFrom([rdfs:comment]))':
                  {'abstract': function() {
                      if(this.prop("[dbontology:abstract]")) {
                          return this.getProp("[dbontology:abstract]");
                      } else if(this.prop("[rdfs:comment]")) {
                          return this.getProp("[rdfs:comment]");
                      } else {
                          return "";
                      }
                  }}
                 },
    
    showWidgetsList: ko.observable('menu'),
    showOptionsList: ko.observable('menu')
};

DBWidgets.toolbarController.showStoreFrontend = function() {
    try {
        DBWidgets.toolbarController.optionsClickedOut();
        DBWidgets.frontend = new rdfstore_frontend('#frontend',sko.store);
    }catch(e) {
        logger.error("TERRIBLE ERROR");
    }
};

DBWidgets.toolbarController.serialize = function() {
    try{
        var tmp = DBWidgets.guiToN3();
        var id = tmp[0];
        var data = tmp[1]
        
        jQuery("#upload-file").attr("action","/dbwidgets/download/"+id);
        jQuery("#upload-file #n3-body").val(data);
        jQuery("#upload-file").submit();
    }catch(e) {
        alert("There was an error serializing this user interface");
    }
};

DBWidgets.toolbarController.deserialize = function() {
    var id = DBWidgets.createFileUpload()
};

DBWidgets.toolbarController.widgetsClickedIn = function() {
    if(this.showWidgetsList() === 'menu') {
        this.showWidgetsList('menu open');
    }
};

DBWidgets.toolbarController.widgetsClickedOut = function() {
    if(this.showWidgetsList() === 'menu open') {
        this.showWidgetsList('menu');
    }
};

DBWidgets.toolbarController.optionsClickedIn = function() {
    if(this.showOptionsList() === 'menu') {
        this.showOptionsList('menu open');
    }
};

DBWidgets.toolbarController.optionsClickedOut = function() {
    if(this.showOptionsList() === 'menu open') {
        this.showOptionsList('menu');
    }
};

DBWidgets.toolbarController.showOptionList = function() {
    jQuery('#options-list').show();
};

DBWidgets.toolbarController.hideOptionList = function() {
    jQuery('#options-list').hide();
};

DBWidgets.toolbarController.showWidgetList = function() {
    jQuery('#widgets-list').show();
};

DBWidgets.toolbarController.hideWidgetList = function() {
    jQuery('#widgets-list').hide();
};

DBWidgets.toolbarController.currentUri = ko.observable('');
DBWidgets.toolbarController.currentResource = ko.observable(null);

DBWidgets.toolbarController.doLoadNewUri = function(remoteUri, cb) {
    var modalId = DBWidgets.createModal("Loading graph", "Clearing current data");

    DBWidgets.toolbarController.currentUri("");

    window['rdfaDefaultNS'] = jQuery.uri(remoteUri);
    window['rdfaCurrentSubject'] = jQuery.uri(remoteUri);

    jQuery("#load-page-btn a").hide();
    sko.store.execute("DELETE { ?s ?p ?o } WHERE { ?s ?p ?o }", function(){
        DBWidgets.updateModalText("Loading graph from URI:"+remoteUri);
        sko.store.load('remote',
                       remoteUri,
                       function(success, quads) {
                           DBWidgets.updateModalText("Updating RDF graph");
                           jQuery("#load-page-btn a").show();
                           if(success) {
                               sko.store.execute("SELECT * { ?s ?p ?o }", function(success, bindings) {
                                   DBWidgets.updateModalText("Selecting root node");
                                   var counter = {};
                                   var subject;

                                   for(var i=0; i<bindings.length; i++) {
                                       subject = bindings[i].s.value;
                                       if(counter[subject] == null) {
                                           counter[subject] = 1;
                                       } else {
                                           counter[subject]++;
                                       }
                                   }

                                   var max = null;
                                   var maxCounter = null;
                                   for(var s in counter) {
                                       if(max == null || counter[s] > maxCounter) {
                                           max = s;
                                           maxCounter = counter[s];
                                       }
                                   }

                                   jQuery('#frontend-overlay').hide();
                                   DBWidgets.toolbarController.currentResource(max);
                                   jQuery("#"+modalId).remove();

                                   if(cb) { alert("Resource loaded"); cb(true); }
                               });
                           } else {
                               jQuery('#frontend-overlay').hide();
                               alert("Error loading graph: "+quads);                                     
                               jQuery("#"+modalId).remove();
                               if(cb) { cb(false); }
                           }
                       });
    });
};

DBWidgets.toolbarController.loadNewUri = function(){
    var uriOrWord = DBWidgets.toolbarController.currentUri();
    if(uriOrWord.indexOf("http") != 0) {
        jQuery.get("http://lookup.dbpedia.org/api/search.asmx/KeywordSearch?QueryString="+encodeURIComponent(uriOrWord),function(data) {
            try {
                var uri = jQuery('ArrayOfResult Result:first-child URI:first', data).text();
                if(uri && uri.indexOf("http://dbpedia.org") === 0) {
                    DBWidgets.toolbarController.doLoadNewUri(uri.replace("resource","page"));
                } else {
                    alert("Impossible to find a resource for the query string: '"+uriOrWord+"'");
                }
            } catch(e) {
                alert("Impossible to find a resource for the query string: '"+uriOrWord+"'");
            }
        });
    } else {
        DBWidgets.toolbarController.doLoadNewUri(uriOrWord, arguments[0]);
    }
};

DBWidgets.widgetsBeingDisplayed = {};

DBWidgets.toolbarController.createWidget = function(widgetClassId) {
    var widgetClass, top, left, position;
    if(typeof(widgetClassId) === 'string') {
        widgetClass = DBWidgets.widgetNames[widgetClassId];
        top = "0px";
        left = "0px";
        position = 'relative';
    } else {
        widgetClass = eval(widgetClassId.type);
        top = widgetClassId.top;
        left = widgetClassId.left;
        position = 'absolute'
    }

    var widget = new widgetClass();
    jQuery("#grid").append(widget.render());

    jQuery("#"+widget.id).attr("about","currentResource");    
    jQuery("#"+widget.id).css("top",top);
    jQuery("#"+widget.id).css("left",left);
    jQuery("#"+widget.id).css("margin","5px");
    jQuery("#"+widget.id).css("padding","15px");
    jQuery("#"+widget.id).css("position",position);
    jQuery("#"+widget.id).css("min-width",(widgetClass.width-(2*20))+"px");
    jQuery("#"+widget.id).css("min-height",(widgetClass.height-(2*20))+"px");
    jQuery("#"+widget.id).css("max-width",(widgetClass.width-(2*20))+"px");
    jQuery("#"+widget.id).css("max-height",(widgetClass.height-(2*20))+"px");
    jQuery("#"+widget.id).draggable({ grid: [100,100], distance: 20, containment: "#grid" });    

    var controller = widget.controllerBuilder();
    widget.controller = controller;
    sko.applyBindings("#"+widget.id, controller, function(){
        widget.postCreate();
        jQuery('#'+widget.id+' a.close').bind('click',function() {
            delete DBWidgets.widgetsBeingDisplayed['#'+widget.id];
            resource = jQuery('#'+widget.id)[0];
            ko.removeNode(resource);
        }) ;
    });

    DBWidgets.widgetsBeingDisplayed['#'+widget.id] = widget;

    this.showWidgetsList('menu');
}

// Widgets globals
DBWidgets.widgetCounter = 0;

// header
DBWidgets.widgetHeader = function(title) {
    return "<div class='modal-header'><h3>"+title+"</h3><a class='close' href='#'>x</a></div>";
};

// TripleCounter widget
DBWidgets.TripleCounterWidget = function(){
    this.label = 'tripleCounter label';
    this.id = 'tripleCounter-widget-'+DBWidgets.widgetCounter;
    this.widgetType = 'DBWidgets.TripleCounterWidget';
};

DBWidgets.TripleCounterWidget.prototype.render = function(){
    DBWidgets.widgetCounter++;

    return "<div id='"+this.id+"' class='widget tripleCounter-widget'>"+DBWidgets.widgetHeader("Triple Counter")+"<div data-bind='text: numTriples'></div></div>";
};

DBWidgets.TripleCounterWidget.width = 200;
DBWidgets.TripleCounterWidget.height = 100;

DBWidgets.TripleCounterWidget.prototype.controllerBuilder = function(){
    var that = this;
    var model = {
        numTriples: ko.observable("-- triples"),
        currentResource: ko.dependentObservable(function(){ return DBWidgets.toolbarController.currentResource() })
    };
    return model;
};

DBWidgets.TripleCounterWidget.prototype.postCreate = function(){
    var that = this;
    this.nodeObserver = ko.dependentObservable(function(){
            //DBWidgets.toolbarController.currentResource();
            console.log("TRIPLE COUNTER WIDGET: "+"#"+that.id);
            var resource = sko.currentResource("#"+that.id);
            if(resource) {

                console.log(resource.about());
                var counter = 0;
                for(var p in resource.valuesMap) {
                    counter++;
                }

                that.controller.numTriples(counter+" triples");
            } else {
                that.controller.numTriples("-- triples");
            }
        });
};

// About widget
DBWidgets.AboutWidget = function(){
    this.label = 'about label';
    this.id = 'about-widget-'+DBWidgets.widgetCounter;
    this.widgetType = 'DBWidgets.AboutWidget';
};

DBWidgets.AboutWidget.prototype.render = function(){
    DBWidgets.widgetCounter++;

    return "<div id='"+this.id+"' class='widget about-widget'>"+DBWidgets.widgetHeader("About")+"<div data-bind='text: label'></div></div>";
};

DBWidgets.AboutWidget.width = 300;
DBWidgets.AboutWidget.height = 100;

DBWidgets.AboutWidget.prototype.controllerBuilder = function(){
    var that = this;
    var model = {
        label: ko.observable("--"),
        currentResource: ko.dependentObservable(function(){ return DBWidgets.toolbarController.currentResource() })
    };
    return model;
}

DBWidgets.AboutWidget.prototype.postCreate = function(){
    var that = this;
    this.nodeObserver = ko.dependentObservable(function(){
        //DBWidgets.toolbarController.currentResource();
        console.log("ABOUT WIDGET: "+"#"+that.id);
        var resource = sko.currentResource("#"+that.id);
        if(resource) {
            if(resource[sko.NTUri('[foaf:name]')]) {
                that.controller.label(resource[sko.NTUri('[foaf:name]')]());
            } else if(resource[sko.NTUri('[rdfs:label]')]) {
                that.controller.label(resource[sko.NTUri('[rdfs:label]')]());
            }
        } else {
            that.controller.label("--");
        }
    });
};

// Location widget
DBWidgets.LocationWidget = function(){
    this.label = 'location label';
    this.id = 'location-widget-'+DBWidgets.widgetCounter;
    this.widgetType = 'DBWidgets.LocationWidget';
};

DBWidgets.LocationWidget.prototype.mapId = function() {
    return this.id+"-map";
}
DBWidgets.LocationWidget.prototype.render = function(){
    DBWidgets.widgetCounter++;

    return "<div id='"+this.id+"' class='widget location-widget'>"+DBWidgets.widgetHeader("Location")+"<div  class='map-container' id='"+this.mapId()+"' data-bind='text: label'></div></div>";
};

DBWidgets.LocationWidget.width = 300;
DBWidgets.LocationWidget.height = 300;

DBWidgets.LocationWidget.prototype.controllerBuilder = function(){
    var that = this;
    var model = {
        label: ko.observable(""),
        currentResource: ko.dependentObservable(function(){ return DBWidgets.toolbarController.currentResource() })
    };
    return model;
}

DBWidgets.LocationWidget.prototype.postCreate = function(){
    var that = this;
    this.nodeObserver = ko.dependentObservable(function(){
        //DBWidgets.toolbarController.currentResource();
        console.log("LOCATION WIDGET: "+"#"+that.id);
        var resource = sko.currentResource("#"+that.id);

        if(resource) {
            var latitude = null;
            var longitude = null;

            if(latitude==null && longitude==null && 
               resource['<http://www.w3.org/2003/01/geo/wgs84_pos#lat>'] && resource['<http://www.w3.org/2003/01/geo/wgs84_pos#long>'] &&
               resource['<http://www.w3.org/2003/01/geo/wgs84_pos#lat>']() !=null  && resource['<http://www.w3.org/2003/01/geo/wgs84_pos#long>']() != null) {
                latitude = parseFloat(resource['<http://www.w3.org/2003/01/geo/wgs84_pos#lat>']());
                longitude = parseFloat(resource['<http://www.w3.org/2003/01/geo/wgs84_pos#long>']());
            }

            if(latitude==null && longitude==null && resource[sko.NTUri('<http://www.georss.org/georss/point>')] && resource[sko.NTUri('<http://www.georss.org/georss/point>')]()!=null) {
                var point = resource['<http://www.georss.org/georss/point>']();
                if(point != null) {
                        point = point.split(" ");
                    latitude = parseFloat(point[0])
                    longitude = parseFloat(point[1]);
                }
            }

            if(latitude != null && longitude != null) {
                var latlng = new google.maps.LatLng(latitude, longitude);
                var myOptions = {  zoom: 8,
                                   center: latlng,
                                   mapTypeId: google.maps.MapTypeId.ROADMAP};

                console.log("MAP INSERTED INTO "+that.mapId());
                var map = new google.maps.Map(document.getElementById(that.mapId()), myOptions);
                jQuery("#"+that.mapId()).show();
            } else {
                jQuery("#"+that.mapId()).hide();
            }
        } else {
            that.controller.label("--");
        }
    });
};

// Depiction widget
DBWidgets.DepictionWidget = function(){
    this.label = ' -- ';
    this.id = 'depiction-widget-'+DBWidgets.widgetCounter;
    this.widgetType = 'DBWidgets.DepictionWidget';

};

DBWidgets.DepictionWidget.prototype.render = function(){
    DBWidgets.widgetCounter++;

    return "<div id='"+this.id+"' class='widget depiction-widget'>"+DBWidgets.widgetHeader("Depiction")+"<img data-bind='attr: {src: (sko.current().depiction) ? sko.current().depiction() : \"#\"}'></img></div>";
};

DBWidgets.DepictionWidget.width = 300;
DBWidgets.DepictionWidget.height = 300;

DBWidgets.DepictionWidget.prototype.controllerBuilder = function(){
    var that = this;
    var model = {
        label: ko.observable("--"),
        currentResource: ko.dependentObservable(function(){ 
            return DBWidgets.toolbarController.currentResource() 
        })
    };
    return model;
}

DBWidgets.DepictionWidget.prototype.postCreate = function(){};


// Age widget
DBWidgets.AgeWidget = function(){
    this.label = ' -- ';
    this.id = 'age-widget-'+DBWidgets.widgetCounter;
    this.widgetType = 'DBWidgets.AgeWidget';
};

DBWidgets.AgeWidget.prototype.render = function(){
    DBWidgets.widgetCounter++;

    return "<div id='"+this.id+"' class='widget age-widget'>"+DBWidgets.widgetHeader("Age")+"<div data-bind='text: ((sko.current().age) ? sko.current().age() : \"--\")}'></div></div>";
};

DBWidgets.AgeWidget.width = 200;
DBWidgets.AgeWidget.height = 100;

DBWidgets.AgeWidget.prototype.controllerBuilder = function(){
    var that = this;
    var model = {
        label: ko.observable("--"),
        currentResource: ko.dependentObservable(function(){ 
            return DBWidgets.toolbarController.currentResource() 
        })
    };
    return model;
}

DBWidgets.AgeWidget.prototype.postCreate = function(){};


// Abstract widget
DBWidgets.AbstractWidget = function(){
    this.label = ' -- ';
    this.id = 'abstract-widget-'+DBWidgets.widgetCounter;
    this.widgetType = 'DBWidgets.AbstractWidget';
};

DBWidgets.AbstractWidget.prototype.render = function(){
    DBWidgets.widgetCounter++;

    return "<div id='"+this.id+"' class='widget abstract-widget'>"+DBWidgets.widgetHeader("Abstract")+"<textarea data-bind='text: ((sko.current().abstract) ? sko.current().abstract() : \"\")}'></textarea></div>";
};

DBWidgets.AbstractWidget.width = 400;
DBWidgets.AbstractWidget.height = 300;

DBWidgets.AbstractWidget.prototype.controllerBuilder = function(){
    var that = this;
    var model = {
        currentResource: ko.dependentObservable(function(){ 
            return DBWidgets.toolbarController.currentResource() 
        })
    };
    return model;
}

DBWidgets.AbstractWidget.prototype.postCreate = function(){};


DBWidgets.widgetNames = {'tripleCounter': DBWidgets.TripleCounterWidget,
                         'about': DBWidgets.AboutWidget,
                         'location': DBWidgets.LocationWidget,
                         'depiction': DBWidgets.DepictionWidget,
                         'age': DBWidgets.AgeWidget,
                         'abstract': DBWidgets.AbstractWidget};

// Network Transport
DBWidgets.ProxyNetworkTransport = {};

// URI to connect
DBWidgets.ProxyNetworkTransport.proxyUri = null;

DBWidgets.ProxyNetworkTransport.load = function(uri, accept, callback, redirect) {
    var transport = jQuery;
    // encoding URI
    uri = DBWidgets.ProxyNetworkTransport.proxyUri+"?uri="+escape(uri);

    transport.ajax({
        url: uri,

        beforeSend: function(xhr) {
            xhr.setRequestHeader('Accept', accept);
        },

        success: function(data, status, xhr){
            if((""+xhr.status)[0] == '2') {
                var headers = xhr.getAllResponseHeaders().split("\n");
                var acum = {};
                for(var i=0; i<headers.length; i++) {
                    var header = headers[i].split(":");
                    acum[header[0]] = header[1];
                }

                callback(true, {headers: acum, 
                                data: data});
            }
        },

        error: function(xhr, textStatus, ex){
            if((""+xhr.status)[0] == '3'){                            
                if(redirection == 0) {
                    callback(false, 500);
                } else {
                    var location = (xhr.getAllResponseHeaders()["Location"] || xhr.getAllResponseHeaders()["location"])
                    if(location != null) {
                        DBWidgets.ProxyNetworkTransport.load(location, accept, callback, (redirection -1));
                    } else {
                        callback(false, 500);
                    }
                } 
            } else {
                callback(false, xhr.statusCode());
            }
        }
    });
};

DBWidgets.RDFaParser = {};

DBWidgets.RDFaParser.parseResource = function(resource,blankPrefix, graph, defaultSubject) {
    var currentUri = jQuery.uri.base().toString();
    if(currentUri.indexOf("#") != -1) {
        currentUri = currentUri.split("#")[0];
    }
    if(resource.type === 'uri') {
        if(resource.value._string.indexOf(currentUri) != -1) {
            var suffix = resource.value._string.split(currentUri)[1];
            var defaultPrefix = defaultSubject.toString();
            if(suffix != "") {
                defaultPrefix = defaultPrefix.split("#")[0]
            }
            return {'uri': defaultPrefix+suffix};
        } else {
            return {'uri': resource.value._string };
        }
    } else if(resource.type === 'bnode') {
        var tmp = resource.toString();
        if(tmp.indexOf("_:")===0) {
            return {'blank': resource.value + blankPrefix };
        } else {
            return {'blank': "_:"+tmp};
        }

    } else if(resource.type === 'literal') {
        return {'literal': resource.toString()};
    }
};

DBWidgets.RDFaParser.parseQuad = function(graph, parsed, blankPrefix, defaultSubject) {
    var quad = {};
    quad['subject'] = DBWidgets.RDFaParser.parseResource(parsed.subject, blankPrefix, graph, defaultSubject);
    quad['predicate'] = DBWidgets.RDFaParser.parseResource(parsed.property, blankPrefix, graph, defaultSubject);
    quad['object'] = DBWidgets.RDFaParser.parseResource(parsed.object, blankPrefix, graph, defaultSubject);
    quad['graph'] = graph;

    return quad;
};

DBWidgets.RDFaParser.parse = function(data, graph) {
    var nsRegExp = /\s*xmlns:(\w*)="([^"]+)"\s*/i;
    var ns = {};

    // some default attributes
    ns['og'] = jQuery.uri("http://ogp.me/ns#");
    ns['fb'] = jQuery.uri("http://www.facebook.com/2008/fbml");

    var baseRegExp  = /\s*xmlns="([^"]+)"\s*/i
    var baseMatch = baseRegExp.exec(data);

    if(baseMatch != null) {
        window['rdfaDefaultNS'] = jQuery.uri(baseMatch[1]);
    }

    var tmp = data;
    var match = nsRegExp.exec(tmp);
    var index = null;
    while(match != null) {
        ns[match[1]] = jQuery.uri(match[2]);
        tmp = tmp.slice(match.index+match[0].length, tmp.length);
        match = nsRegExp.exec(tmp);
    }

    window['globalNs'] = ns;
    
    var parsed = jQuery(data).rdfa().databank.triples();
    var quads = [];
    var prefix = ""+(new Date()).getTime();
    for(var i=0; i<parsed.length; i++) {
        quads.push(DBWidgets.RDFaParser.parseQuad(graph,parsed[i],prefix, window['rdfaCurrentSubject']));
    }
    
    return quads;
};

// RDFParser
DBWidgets.RDFParser = {};

DBWidgets.RDFParser.parse = function(data, graph) {
    var parsed = jQuery().rdf().databank.load(data).triples();
    var quads = [];
    var prefix = ""+(new Date()).getTime();
    for(var i=0; i<parsed.length; i++) {
        quads.push(DBWidgets.RDFaParser.parseQuad(graph,parsed[i],prefix, window['rdfaCurrentSubject']));
    }
    
    return quads;
};


// pop ups

DBWidgets.modalCounter = 1;


DBWidgets.createModal = function(title, text) {
    jQuery('#frontend-overlay').show();
    var id = 'modal-dialog-'+DBWidgets.modalCounter;
    DBWidgets.modalCounter++;

    html = "<div id='"+id+"' class='modal' style='position: absolute; top: auto; left: auto; margin: 0 auto; z-index: 2000'>";
    html = html + "<div class='modal-header'><h3>"+title+"</h3></div>";
    html = html + "<div class='modal-body'>"+text+"</div>";

    jQuery("body").append(html);
    jQuery("#"+id).centerGrid();
    
    return id;
};

DBWidgets.updateModalText = function(text) {
    jQuery(".modal-body").text(text);
};


DBWidgets.createFileUpload = function() {
    jQuery('#frontend-overlay').show();
    var id = 'file-upload-modal'
    DBWidgets.modalCounter++;

    html = "<div id='"+id+"' class='modal' style='position: absolute; top: auto; left: auto; margin: 0 auto; z-index: 2000'>";
    html = html + "<div class='modal-header'><h3>Choose a N3 interface file</h3></div>";
    html = html + "<div class='modal-body'><input type='file' onchange='DBWidgets.handleInterfaceRead(this.files)'></input></div>";
    html = html + "<div class='modal-footer'><a class='btn secondary' onclick='DBWidgets.removeInterfaceRead()'>Cancel</a></div>";
    html = html + "</div>";

    jQuery("body").append(html);
    jQuery("#"+id).centerGrid();
    
    return id;
};

DBWidgets.removeInterfaceRead = function(){
    jQuery('#file-upload-modal').remove();
    jQuery('#frontend-overlay').hide();
};

DBWidgets.handleInterfaceRead = function(files) {
    console.log(files);
    var fileReader = new FileReader();
    fileReader.onloadend = function(evt) {
        console.log("LOADING:");
        console.log(evt.target.result);

        DBWidgets.removeInterfaceRead();

        sko.store.clear("http://dbwidgets.com/graphs/ui", function(success) {
            if(success) {
            sko.store.load("text/n3", evt.target.result, "http://dbwidgets.com/graphs/ui",
                           function(res, data) {
                               var targetQuery = "select ?o { GRAPH <http://dbwidgets.com/graphs/ui> { ?s <http://dbwidgets.com/ui/props/displays> ?o } }";
                               sko.store.execute(targetQuery, function(s,r){ 
                                   if(success && r && r.length === 1) {
                                       var resourceToLoad = r[0].o.value;
                                       var widgetsQuery = "select ?left ?top ?type { GRAPH <http://dbwidgets.com/graphs/ui> { \
                                                                                      ?s a <http://dbwidgets.com/ui/elements/Widget>.\
                                                                                      ?s <http://dbwidgets.com/ui/props/left> ?left.\
                                                                                      ?s <http://dbwidgets.com/ui/props/top> ?top.\
                                                                                      ?s <http://dbwidgets.com/ui/props/type> ?type } }"

                                        sko.store.execute(widgetsQuery, function(res, widgets) {
                                                if(res) {
                                                    var widget, widgetInfo, type, top, left;
                                                    for (var w in DBWidgets.widgetsBeingDisplayed) {
                                                        widget =  DBWidgets.widgetsBeingDisplayed[w];
                                                        delete DBWidgets.widgetsBeingDisplayed[w];
                                                        resource = jQuery('#'+widget.id)[0];
                                                        ko.removeNode(resource);
                                                    }

                                                    DBWidgets.toolbarController.currentUri(resourceToLoad);
                                                    DBWidgets.toolbarController.loadNewUri(function(result){

                                                            for(var i=0; i<widgets.length; i++) {
                                                                widgetInfo =  widgets[i];
                                                                type = widgetInfo.type.value;
                                                                top = parseFloat(widgetInfo.top.value);
                                                                left = parseFloat(widgetInfo.left.value);
                                                                DBWidgets.toolbarController.createWidget({'type':type, 'top':top+'px', 'left': left+'px'})
                                                            }
                                                    });
                                                } else {
                                                    console.log("Error recovering widgets description fro N3 Interface file");
                                                }
                                         })
                                   } else {
                                       console.log("Error loading interface, cannot find target DBPedia URI");
                                   }
                               });
                           });
            } else {
                console.log("Error loading interface N3 interface file");
            }
        });
    };

    fileReader.readAsText(files[0]);
};

jQuery.fn.centerGrid = function () {
    var bounds = jQuery("#grid").position();
    var height = jQuery("#grid").height();
    var width = jQuery("#grid").width();
    this.css("top", ((height - bounds.top) / 2) + $(window).scrollTop() - (this.height()/2) + "px");
    this.css("left", ((width - bounds.left) / 2) + $(window).scrollLeft() - (this.width()/2) + "px");

    return this;
};


DBWidgets.guidGenerator = function() {
    var S4 = function() {
        return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
};

DBWidgets.guiToN3 = function() {
    var id = "_:"+DBWidgets.guidGenerator();
    id = id.replace(/-/g,"");
    var widgets = {};
    var counter = 0;
    var widgetId, position;
    var html = ""

    html = html + id + " a <http://dbwidgets.com/ui/elements/Interface> .\n";
    html = html + id + " <http://dbwidgets.com/ui/props/displays> <"+DBWidgets.toolbarController.currentResource()+"> .\n"
    for(var p in  DBWidgets.widgetsBeingDisplayed) {
        var whtml = "";
        widget = DBWidgets.widgetsBeingDisplayed[p];
        widgetId = "_:w"+counter;
        counter++;
        position  = jQuery(p).position();
        whtml = whtml+widgetId+" a <http://dbwidgets.com/ui/elements/Widget> .\n";
        whtml = whtml+widgetId+" <http://dbwidgets.com/ui/props/left> \""+position.left+"\"^^<http://www.w3.org/2001/XMLSchema#int> .\n";
        whtml = whtml+widgetId+" <http://dbwidgets.com/ui/props/top> \""+position.top+"\"^^<http://www.w3.org/2001/XMLSchema#int> .\n";
        whtml = whtml+widgetId+" <http://dbwidgets.com/ui/props/type> \""+widget.widgetType+"\" .\n";        
        html = html + id + " <http://dbwidgets/com/ui/props/includes> "+widgetId+" .\n"
        widgets[widgetId] = whtml;
        
    }

    for(var p in widgets) {
        html = html + widgets[p];
    }

    return [id, html];
};
