function runTest()
{
    FBTest.sysout("examples.commandline.START");
    FBTest.openNewTab(basePath + "examples/exampleCommandLine1.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.enableConsolePanel(function(win)
        {
            var config = {tagName: "span", classes: "objectBox objectBox-number"};
            FBTest.waitForDisplayedElement("console", config, function(row)
            {
                FBTest.compare("3", row.textContent, "Number 3 must be displayed");
                FBTest.testDone("examples.commandline.DONE");
            });

            FBTest.executeCommand("1+2");
        });
    });
}
