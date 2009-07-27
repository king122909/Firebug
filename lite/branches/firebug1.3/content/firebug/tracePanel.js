FBL.ns(function() { with (FBL) {
// ************************************************************************************************

// If application isn't in debug mode, the FBTrace panel won't be loaded
if (!Application.isDebugMode) return;

// ************************************************************************************************
// FBTrace Module

Firebug.Trace = extend(Firebug.Module,
{
    getPanel: function()
    {
        return Firebug.chrome ? Firebug.chrome.getPanel("Trace") : null;
    },
    
    clear: function()
    {
        this.getPanel().panelContent.innerHTML = "";
    }
});

Firebug.registerModule(Firebug.Trace);


// ************************************************************************************************
// FBTrace Panel

function TracePanel(){};

TracePanel.prototype = extend(Firebug.Panel,
{
    name: "Trace",
    title: "Trace",
    
    options: {
        hasToolButtons: true
    },
    
    create: function(){
        Firebug.Panel.create.apply(this, arguments);
        
        this.clearButton = new Firebug.Button({
            caption: "Clear",
            title: "Clear FBTrace logs",            
            module: Firebug.Trace,
            //panel: this,
            onClick: Firebug.Trace.clear
        });
    },
    
    initialize: function(){
        Firebug.Panel.initialize.apply(this, arguments);
        
        this.clearButton.initialize();
    }
    
});

Firebug.registerPanel(TracePanel);

// ************************************************************************************************
}});