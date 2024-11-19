document.addEventListener("DOMContentLoaded", () => {
  const tabsContainer = document.getElementById("tabs-container");
  const savedGroupsContainer = document.getElementById("saved-groups");
  const saveGroupButton = document.getElementById("save-group");
  const darkModeToggle = document.getElementById("dark-mode-toggle");

  // Load initial dark mode state
  chrome.storage.sync.get("darkMode", (data) => {
    if (data.darkMode) {
      document.body.classList.add("dark-mode");
    }
  });

  // Dark mode toggle button handler
  darkModeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDarkMode = document.body.classList.contains("dark-mode");

    // Save the state to Chrome storage
    chrome.storage.sync.set({ darkMode: isDarkMode }, () => {
      console.log(`Dark mode is now ${isDarkMode ? "enabled" : "disabled"}.`);
    });
  });

  // Fetch and display all open tabs
  chrome.tabs.query({}, (tabs) => {
    tabsContainer.innerHTML = "";
    tabs.forEach((tab) => {
      const tabItem = document.createElement("div");
      tabItem.className =
        "flex justify-between items-center p-3 bg-white shadow rounded-lg";

      tabItem.innerHTML = `
        <span class="text-gray-700 truncate">${tab.title}</span>
        <span class="text-sm text-blue-500 truncate">${new URL(tab.url).hostname}</span>
      `;
      tabsContainer.appendChild(tabItem);
    });
  });

  // Fetch and display saved groups
  const loadSavedGroups = () => {
    chrome.storage.sync.get(null, (groups) => {
      savedGroupsContainer.innerHTML = "";
      Object.keys(groups).forEach((groupName) => {
        const group = groups[groupName];
        if (!Array.isArray(group)) return;

        const groupItem = document.createElement("li");
        groupItem.className =
          "flex flex-col bg-white shadow rounded-lg p-3";
        groupItem.innerHTML = `
          <div class="flex justify-between items-center">
            <span class="text-gray-700 font-medium truncate">
              ${groupName} <span class="text-sm text-gray-500">(${group.length} tabs)</span>
            </span>
            <div class="flex items-center space-x-2">
              <button class="reopen-group text-green-500 hover:text-green-700" data-group="${groupName}">Reopen</button>
              <button class="add-to-group text-yellow-500 hover:text-yellow-700" data-group="${groupName}">Add</button>
              <button class="delete-group text-red-500 hover:text-red-700" data-group="${groupName}">Delete</button>
            </div>
          </div>
          <ul class="space-y-2 mt-2">
            ${group
              .map(
                (tab, index) => `
                <li class="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                  <span class="text-sm text-blue-500 truncate">${tab.title}</span>
                  <div class="flex items-center space-x-2">
                    <span class="text-xs text-gray-500">${new URL(tab.url).hostname}</span>
                    <button class="delete-tab text-red-500" data-group="${groupName}" data-index="${index}">Remove</button>
                  </div>
                </li>
              `
              )
              .join("")}
          </ul>
        `;
        savedGroupsContainer.appendChild(groupItem);
      });
    });
  };

  // Save a new group
  saveGroupButton.addEventListener("click", () => {
    const groupName = prompt("Enter a group name:");
    if (!groupName || groupName.trim() === "") {
      alert("Group name cannot be empty!");
      return;
    }

    chrome.tabs.query({}, (tabs) => {
      const group = tabs.map((tab) => ({ title: tab.title, url: tab.url }));
      chrome.storage.sync.set({ [groupName]: group }, () => {
        alert("Group saved successfully!");
        loadSavedGroups();
      });
    });
  });

  // Handle group actions
  savedGroupsContainer.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;

    const groupName = target.dataset.group;

    // Reopen group
    if (target.classList.contains("reopen-group")) {
      chrome.storage.sync.get(groupName, (data) => {
        const tabs = data[groupName];
        if (!tabs || tabs.length === 0) {
          alert("This group has no tabs to open.");
          return;
        }
        tabs.forEach((tab) => chrome.tabs.create({ url: tab.url }));
      });
    }

    // Add URL to group
    if (target.classList.contains("add-to-group")) {
      chrome.storage.sync.get(groupName, (data) => {
        const group = data[groupName] || [];
        const newUrl = prompt("Enter the URL to add to the group:");
        if (!newUrl) return;

        try {
          const validUrl = new URL(newUrl);
          const newTab = { title: validUrl.href, url: validUrl.href };
          group.push(newTab);

          chrome.storage.sync.set({ [groupName]: group }, () => {
            alert("URL added successfully!");
            loadSavedGroups();
          });
        } catch (e) {
          alert("Invalid URL. Please try again.");
        }
      });
    }

    // Delete group
    if (target.classList.contains("delete-group")) {
      if (confirm(`Are you sure you want to delete the group "${groupName}"?`)) {
        chrome.storage.sync.remove(groupName, () => {
          alert("Group deleted!");
          loadSavedGroups();
        });
      }
    }

    // Delete tab from group
    if (target.classList.contains("delete-tab")) {
      const index = target.dataset.index;
      if (confirm("Are you sure you want to delete this tab from the group?")) {
        chrome.storage.sync.get(groupName, (data) => {
          const group = data[groupName];
          if (group && index >= 0 && index < group.length) {
            group.splice(index, 1);
            chrome.storage.sync.set({ [groupName]: group }, () => {
              alert("Tab removed successfully!");
              loadSavedGroups();
            });
          }
        });
      }
    }
  });

  // Initial load of saved groups
  loadSavedGroups();
});