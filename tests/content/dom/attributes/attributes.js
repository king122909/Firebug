var expectedValue = "[style=\"color: green;\", name=\"testName\", id=\"testId\"]";


function runTest()
{
    FBTest.sysout("attributes.START");
    FBTest.openNewTab(basePath + "dom/attributes/attributes.html", function(win)
    {
        FBTest.openFirebug();
 
        FBTest.enableConsolePanel(function(win)
        {
            var tasks = new FBTest.TaskList();
            tasks.push(testDomPanel);

            tasks.push(executeCommandAndVerify,
                "$('testId').attributes", expectedValue,
                "a", "objectLink objectLink-NamedNodeMap");

            tasks.push(executeCommandAndVerify,
                "$('testId').attributes[0]",
                "style=\"color: green;\"",
                "a", "objectLink objectLink-Attr");

            tasks.run(function() {
                FBTest.testDone("attributes.DONE");
            })
        });
    });
}

function testDomPanel(callback)
{
    FBTest.searchInHtmlPanel("Inspect Me", function(sel)
    {
        FBTest.progress("Element found");

        var nodeLabelBox = FW.FBL.getAncestorByClass(sel.anchorNode, "nodeLabelBox");
        var nodeTag = nodeLabelBox.querySelector(".nodeTag");

        FBTest.executeContextMenuCommand(nodeTag, "InspectIndomTab", function()
        {
            var panel = FBTest.selectPanel("dom");
            var rows = panel.panelNode.querySelectorAll(".memberRow.domRow.hasChildren");

            FBTest.waitForDOMProperty("attribute", function(row)
            {
                var value = row.querySelector(".memberValueCell");
                FBTest.compare(expectedValue, value.textContent, "Attributes list must match");
                callback();
            }, true);
        });
    })
}

// xxxHonza: Should be in FBTest (see also commandLine/api.js), what about the callback?
function executeCommandAndVerify(callback, expression, expected, tagName, classes)
{
    var config = {tagName: tagName, classes: classes};
    FBTest.waitForDisplayedElement("console", config, function(row)
    {
        FBTest.compare(expected, row.textContent, "Verify: " +
            expression + " SHOULD BE " + expected);

        FBTest.clickToolbarButton(null, "fbConsoleClear");
        callback();
    });

    FBTest.executeCommand(expression);
}
