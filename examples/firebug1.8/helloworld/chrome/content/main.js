/* See license.txt for terms of usage */

define([
    "firebug/lib/trace",
    "helloworld/myPanel"
],
function(FBTrace) {

// ********************************************************************************************* //
// Application

var theApp =
{
    initialize: function()
    {
        if (FBTrace.DBG_HELLOWORLD)
            FBTrace.sysout("helloWorld; my extension initialized!");
    }
}

return theApp;

// ********************************************************************************************* //
});