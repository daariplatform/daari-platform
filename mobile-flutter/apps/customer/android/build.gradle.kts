allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// AGP 9 يرفض أيّ إضافة مُجمَّعة على compileSdk < 34 (مثل app_settings على 33).
// نوحّد compileSdk لكل وحدة مكتبة أندرويد فرعية إلى 36 بدل ملاحقة نسخ كل إضافة.
// نضبطه فوراً للوحدات المُقيَّمة سلفاً (محمّل إضافات Flutter يُقيّمها مبكّراً)،
// وعبر afterEvaluate لما تبقّى — كي يُكتب بعد أن تضبط الإضافة قيمتها (33).
subprojects {
    fun bumpCompileSdk() {
        extensions.findByType<com.android.build.api.dsl.LibraryExtension>()?.compileSdk = 36
    }
    if (state.executed) bumpCompileSdk() else afterEvaluate { bumpCompileSdk() }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
