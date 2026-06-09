from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="demotoken",
            name="usage_limit",
            field=models.IntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="demotoken",
            name="usage_count",
            field=models.IntegerField(default=0),
        ),
    ]
