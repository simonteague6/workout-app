# Android Build Troubleshooting

## 2026-06-17: Java 25 + Gradle 9.3.1 incompatibility

### Symptoms

`npm run android` failed with two errors in sequence:

1. **`Could not initialize class org.gradle.toolchains.foojay.DistributionsKt`**
   ```
   Exception java.lang.NoSuchFieldError: Class org.gradle.jvm.toolchain.JvmVendorSpec
   does not have member field 'org.gradle.jvm.toolchain.JvmVendorSpec IBM_SEMERU'
   ```

2. **`WARNING: A restricted method in java.lang.System has been called`**
   ```
   Execution failed for task ':op-engineering_op-sqlite:configureCMakeDebug[arm64-v8a]'
   ```

### Root cause

The system had **Java 25** (OpenJDK 25+36). Gradle 9.3.1 and the Android Gradle Plugin (AGP) do not fully support Java 25:

- **Error 1**: The React Native Gradle plugin's `foojay-resolver-convention` plugin v0.5.0 referenced `JvmVendorSpec.IBM_SEMERU`, which was removed in Gradle 9.3.1.
- **Error 2**: Java 25 restricts `java.lang.System::load` — a method the AGP's CMake integration calls. The `--add-opens` JVM flags needed to bypass this restriction don't propagate to the CMake subprocess spawned by AGP, and environment variables like `JDK_JAVA_OPTIONS` print a note to stderr that AGP treats as a build error.

### Fix applied

**Installed Temurin JDK 17** (arm64) alongside Java 25 and set `JAVA_HOME` to it at build time.

```bash
# JDK 17 installed at:
~/Library/Java/JavaVirtualMachines/jdk-17.0.19+10/Contents/Home
```

Also patched `node_modules/@react-native/gradle-plugin/settings.gradle.kts` to bump `foojay-resolver-convention` from 0.5.0 to 1.0.0 (this is overwritten on `npm install` but harmless with JDK 17).

### How to run builds going forward

```bash
# Set JAVA_HOME to JDK 17 before any Android build
export JAVA_HOME=~/Library/Java/JavaVirtualMachines/jdk-17.0.19+10/Contents/Home

# Then run normally
npm run android
```

You can make this permanent by adding the `export` line to your shell profile (`~/.zshrc` or `~/.bash_profile`).

### Will this happen again?

**Unlikely with JDK 17.** JDK 17 is the long-term-support version that Gradle 9.x and the current AGP are tested against. The build should be stable as long as `JAVA_HOME` points to JDK 17.

**If you upgrade Gradle or AGP in the future**, check compatibility:
- [Gradle compatibility matrix](https://docs.gradle.org/current/userguide/compatibility.html)
- [AGP compatibility](https://developer.android.com/studio/releases/gradle-plugin#java-version)

**If you switch back to Java 25+**, the same errors will reappear until Gradle and AGP catch up. The `--add-opens` approach via `gradle.properties` or `JDK_JAVA_OPTIONS` doesn't fully work because AGP's CMake integration treats stderr output as build failures.
