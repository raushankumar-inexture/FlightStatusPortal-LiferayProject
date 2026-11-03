# Getting Started with Liferay Workspace

Complete documentation for Liferay Workspace can be found
[here](https://learn.liferay.com/w/dxp/development/tooling/liferay-workspace).

## Folder Structure

```
my-project
├── configs
│ ├── common
│ ├── dev
│ ├── docker
│ ├── local
│ ├── prod
│ └── uat
├── modules
│ ├── apis
│ ├── services
│ ├── java widgets
│ ├── js widgets
│ ├── java ee widgets (spring mvc, jsf, etc)
│ └── java themes
└── themes
    └── js themes
```

## Running Liferay DXP locally

```
my-project $ blade gw initBundle
my-project $ blade gw deploy
my-project $ blade server run
```

## Flight email alerts

Signed-in users can choose **Get email alerts** on a flight or manage followed
flights from **My Alerts**. People who check in also follow their own flight
automatically. The `flight-alerts` module checks flight status, delay and gate
changes every 30 seconds and emails the address on the user's Liferay account.
The last known state of every flight is saved in
`<liferay home>/data/flight-alert-state.json`, so changes made while the server
was stopped are reported after it starts.

Emails are sent through any SMTP server. Set these environment variables for
the Liferay process (for example in `bundles/tomcat/bin/setenv.sh`, which is not
part of the repository) and restart Liferay:

```
export FLIGHT_ALERT_SMTP_HOST=smtp.gmail.com
export FLIGHT_ALERT_SMTP_PORT=587
export FLIGHT_ALERT_SMTP_STARTTLS=true
export FLIGHT_ALERT_SMTP_USER=<mailbox>
export FLIGHT_ALERT_SMTP_PASSWORD=<app password>
export FLIGHT_ALERT_FROM_ADDRESS=<mailbox>
```

For Gmail, create an app password at `myaccount.google.com/apppasswords`. Never
put these values in source control. If `TWILIO_EMAIL_FROM_ADDRESS` is set
together with the Twilio account settings, Twilio Email is used instead.

## Running Liferay DXP in Docker

```
my-project $ blade gw createDockerContainer
my-project $ blade gw startDockerContainer
```

## Creating a Liferay DXP distribution

### Creating a tar

```
my-project $ blade gw distBundleTar
```

### Creating a zip

```
my-project $ blade gw distBundleZip
```

### Creating multiple bundles

```
my-project $ blade gw distBundleTarAll
my-project $ blade gw distBundleZipAll
```

### Creating a docker image

```
my-project $ blade gw buildDockerImage
```

## Create a Liferay DXP module

### Creating a new service

```
my-project $ blade create -t service-builder my-service
```

### Creating a javascript theme

```
my-project $ blade create -t js-theme my-theme
```

### Creating a Java Widget

```
my-project $ blade create -t mvc-portlet "my-java-widget"
```

### Create a JS Widget

```
my-project $ blade create -t js-widget "my-js-widget"
```

## Gradle Properties

Use these `gradle.properties` to customize default settings.

#### liferay.workspace.product
Set the `liferay.workspace.product` to set the `app.server.tomcat.version`,
`liferay.workspace.bundle.url`, `liferay.workspace.docker.image.liferay`, and
`liferay.workspace.target.platform.version` that matches your Liferay Product
Version. To override each of these settings, set them individually. The value
may be `null`, or one of the `releaseKey` values found in
https://releases.liferay.com/releases.json.

This file is refreshed once every 30 days. To force workspace to check for new
releases, use the system property `-Dliferay.workspace.refresh.liferay.releases`.

#### app.server.tomcat.version
Overrides the default setting from
`liferay.workspace.product`. Set the `app.server.tomcat.version` to match what's
inside the Liferay bundle. The `TestIntegrationPlugin` and
`LiferayExtPlugin` rely on this version to match the bundled Tomcat version. If
your configured bundle URL points to a bundle with a different Tomcat version,
set the property below to match that Tomcat version.

#### liferay.workspace.bundle.url
Overrides the default setting from
`liferay.workspace.product`. Set the URL pointing to the bundle Zip to
download.

#### liferay.workspace.docker.image.liferay
Overrides the default setting from
`liferay.workspace.product`. Set the Liferay Portal Docker image to create
your container from.

#### liferay.workspace.target.platform.version
Overrides the default setting from
`liferay.workspace.product`. Set the Liferay Portal or DXP version to
develop and test against. It enables target
platform features such as dependency management and OSGi resolve tasks. Use the
version that matches the Liferay Portal or DXP bundle version in this workspace.
See GETTING_STARTED#Overwrite-specific-dependency-in-one-project for overrides.

For a list of all available target platform versions, see
https://bit.ly/2IkAwwW for Liferay Portal and https://bit.ly/2GIyfZF for
Liferay DXP.

#### liferay.workspace.bundle.cache.dir
Set the directory where the downloaded bundle Zip files are stored. The
default value is `~/.liferay/bundles`.

#### liferay.workspace.default.repository.enabled
Set this to true to configure Liferay CDN as the default repository in the root
project. The default value is `true`.

#### liferay.workspace.environment
Set the environment with the settings appropriate for current development. The
`configs` folder is used to hold different environments in the same workspace.
You can organize environment settings and generate an environment installation
with those settings. There are five environments: common, dev, docker, local,
prod, and uat. The default value is `local`.

#### liferay.workspace.bundle.dist.include.metadata
Set this to true to append metadata for the current environment settings and
timestamp. The default value is `false`.

#### liferay.workspace.dir.excludes.globs
Set a list of glob patterns to exclude from the build life cycle. All glob
patterns start relative to the workspace root directory.

Examples:

```
liferay.workspace.dir.excludes.globs=\
	**/some-wip-project,\
	dependencies/**,\
	modules/**/*-test
```

#### liferay.workspace.docker.local.registry.address
Set this to the host and port of the local Docker registry. This enables the user to interact with a Docker registry other than DockerHub (e.g. myregistryaddress.org:5000).

#### liferay.workspace.docker.pull.policy
Set this to `false` to pull the user's local Docker cache first. The default value is `true`.

#### liferay.workspace.docker.username
Set this property to the registered user name on DockerHub to avoid conflicts with DockerHub.

#### liferay.workspace.docker.user.access.token
See https://docs.docker.com/docker-hub/access-tokens on how to generate a Docker access token.

#### liferay.workspace.ext.dir
Set the folder that contains all Ext OSGi modules and Ext plugins. The default
value is `ext`.

#### liferay.workspace.home.dir
Set the folder that contains the Liferay bundle downloaded from the
`liferay.workspace.bundle.url` property. The default value is `bundles`.

#### liferay.workspace.java.ee.use.jakarta
Set this to true to opt into Jakarta-compatible tooling and dependencies. Workspace
determines whether to use Jakarta dependencies based on the product version, but
setting this property forces the use of certain Jakarta dependencies regardless of the
product version.

Currently this affects

- JSP pre-compilation

The default value is `false`.

#### liferay.workspace.modules.default.repository.enabled
Set this to true to configure Liferay CDN as the default repository for
module/OSGi projects. The default value is `true`.

#### liferay.workspace.modules.dir
Set the folder that contains all module projects. Set to `*` to search all
subdirectories. The default value is `modules`.

#### liferay.workspace.modules.jsp.precompile.enabled
Set this to true to compile the JSP files in OSGi modules and have them added
to the distributable Zip/Tar. The default value is `false`.

#### liferay.workspace.node.lts.codename
Set this property to a Node.js LTS release codename to use the latest Node version and NPM version automatically for that LTS release. See https://github.com/nodejs/Release/blob/main/CODENAMES.md for the list of valid codenames.

This file is refreshed once every 30 days. To force workspace to check for new
releases, use the system property `-Dliferay.workspace.refresh.node.releases`.

#### liferay.workspace.node.package.manager
Set this property to `npm` to build Node.js-style projects using NPM. The
default value is `yarn`.

#### liferay.workspace.plugins.sdk.dir
Set the folder that contains the Plugins SDK environment. The default value is
`plugins-sdk`.

#### liferay.workspace.themes.dir
Set the folder that contains Node.js-style theme projects. The default value is
`themes`.

#### liferay.workspace.themes.java.build
Set this to `true` to build the theme projects using the Liferay Portal Tools
Theme Builder. The default value is `false`.

#### liferay.workspace.wars.dir
Set the folder that contains all legacy WAR projects. Set to `*` to search all
subdirectories. The default value is `modules`.

#### microsoft.translator.subscription.key
Set the subscription key for Microsoft Translation integration. This service
provides automatic translations for `buildLang`.

#### target.platform.index.sources
Set this to true if you have enabled the Target Platform plugin (i.e. you have
set the above property) and you want to apply the `TargetPlatformIDE` plugin to
the root workspace project. This causes all BOM artifact jars and
their Java sources to be indexed by your IDE. Setting this property to true can
slow down your IDE's project synchronization.

## Build Customizations via `build.gradle`

### Overwrite specific dependency in one project
Set `configuration.resolutionStrategy.force 'groupId:artifactId:version'` to
overwrite the version of a specific dependency. See
`https://docs.gradle.org/current/userguide/dependency_downgrade_and_exclude.html#forced_dependencies_vs_strict_dependencies`.

```
configurations {
    compileClasspath {
        resolutionStrategy.force 'groupId:artifactId:version`
    }
}
```

### Overwrite dependency in multiple projects
Use the configuration below to overwrite the version of a dependency for the project.

```
subprojects {
	configurations.all {
		resolutionStrategy.force 'groupId:artifactId:version`
	}
}
```

## SMS login code (optional, not active by default)

The `flight-status-mfa` module is a Liferay multi-factor checker that asks
Twilio Verify to send a one-time code by SMS and to check the code the user
types. It is a separate module so the rest of the portal does not depend on
Liferay's multi-factor bundles.

Requirements:

- Liferay's multi-factor modules must be installed and running. In the
  development server used so far they are shipped in `osgi/portal` but are not
  loaded, so this checker cannot start there (`lb | grep multi.factor` in the
  Gogo shell shows nothing).
- A Twilio Verify service, and these environment variables for the Liferay
  process: `TWILIO_ACCOUNT_SID`, `TWILIO_VERIFY_SERVICE_SID` and either
  `TWILIO_AUTH_TOKEN` or `TWILIO_API_KEY_SID` with `TWILIO_API_KEY_SECRET`.
- A primary phone number in international format (for example `+919876543210`)
  on every user's Liferay profile. A Twilio trial account can only send to
  numbers verified in Twilio.

Do not put any of these values in source control, and rotate any key that has
been shared or exposed.

## platform.bndrun

This file resolves each module against the target version of
Liferay. Invoke the operation using the following command:
`./gradlew resolve`

SUCCESS: The successful result is a list of all the artifacts needed to run
without any resolution errors.
FAILURE: A failure will indicate missing a requirement. Correct the missing
requirement and rerun the task.