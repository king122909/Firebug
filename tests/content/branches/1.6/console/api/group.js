var testWindow;

function runTest()
{
    FBTest.sysout("console.group.START");
    FBTest.openNewTab(basePath + "console/api/group.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.enableConsolePanel(function(win)
        {
            testWindow = win;

            var tests = [];
            tests.push(test1);
            tests.push(clear);
            tests.push(test2);
            FBTest.runTestSuite(tests, function() {
                FBTest.testDone("console.group.DONE");
            });
        });
    });
}

function test1(callback)
{
    FBTest.progress("Run opened group test");

    var config = {tagName: "div", classes: "logRow logRow-info"};
    FBTest.waitForDisplayedElement("console", config, function(row)
    {
        var panelNode = FBTest.getPanel("console").panelNode;
        var group = panelNode.getElementsByClassName(
            "logRow logRow-group logGroup opened")[0];

        FBTest.compare(/Group1\s*log\s*group.html\s*\(line 37\)/,
            group.textContent, "The group must contain one log message");

        callback();
    });
    FBTest.click(testWindow.document.getElementById("testButton1"));
}

function clear(callback)
{
    FBTest.progress("Clear console");

    // Clear console content.
    FBTest.clickToolbarButton(null, "fbConsoleClear");

    callback();
}

function test2(callback)
{
    FBTest.progress("Run collapsed group test");

    var config = {tagName: "div", classes: "logRow logRow-info"};
    FBTest.waitForDisplayedElement("console", config, function(row)
    {
        var panelNode = FBTest.getPanel("console").panelNode;
        var group = panelNode.getElementsByClassName(
            "logRow logRow-group logGroup")[0];

        FBTest.ok(!FW.FBL.hasClass("opened"), "The group must be collapsed by default");
        FBTest.compare(/Group2\s*log\s*group.html\s*\(line 45\)/,
            group.textContent, "The group must contain one log message");

        callback();
    });
    FBTest.click(testWindow.document.getElementById("testButton2"));
}
