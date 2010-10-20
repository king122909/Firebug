/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

const Cc = Components.classes;
const Ci = Components.interfaces;

// ************************************************************************************************
// Module implementation

/**
 * This object represents Console panel listener that listens for Console panel logs
 * and uses {@link Firebug.ConsoleExport.Uploader} to upload them to a specified server.
 */
Firebug.ConsoleExport.Listener =
/** @lends Firebug.ConsoleExport.Listener */
{
    registered: false,

    register: function()
    {
        if (!this.registered)
            Firebug.Console.addListener(this);
    },

    unregister: function()
    {
        if (this.registered)
            Firebug.Console.removeListener(this);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // Console listener

    log: function(context, object, className, sourceLink)
    {
        object = unwrapObject(object);

        if (FBTrace.DBG_CONSOLEEXPORT)
            FBTrace.sysout("consoleexport.Console.Listener.log; " +
                className, object);

        try
        {
            Firebug.ConsoleExport.Uploader.send({
                className: className,
                cat: object.category,
                msg: object.message,
                href: object.href ? object.href : context.getName(),
                lineNo: object.lineNo,
                source: object.source,
            });
        }
        catch (err)
        {
            if (FBTrace.DBG_CONSOLEEXPORT || FBTrace.DBG_ERRORS)
                FBTrace.sysout("consoleexport.Console.Listener.log; EXCEPTION " + err, err);
        }
    },

    logFormatted: function(context, objects, className, sourceLink)
    {
        objects = unwrapObject(objects);

        if (FBTrace.DBG_CONSOLEEXPORT)
            FBTrace.sysout("consoleexport.Console.Listener.logFormatted; " +
                className, objects[0]);

        Firebug.ConsoleExport.Uploader.send({
            className: className,
            cat: "log",
            msg: objects[0],
            href: context.getName(),
        });
    }
};

// ************************************************************************************************
}});